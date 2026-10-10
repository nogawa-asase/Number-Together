import type { GameConfig } from '../domain/config/types';
import { judge } from '../domain/judge/judge';
import type { GraphSample } from '../domain/layout/graphGeometry';
import { pointsForPress } from '../domain/points/pointsForPress';
import { settle } from '../domain/points/settle';
import type { PressKind, StatsDelta } from '../domain/points/types';
import { buildRanking } from '../domain/ranking/buildRanking';
import { roundClockAt } from '../domain/schedule/roundClockAt';
import type { RoundClock } from '../domain/schedule/types';
import { displayPlayerCount } from '../domain/targets/displayPlayerCount';
import { isWithinRange, rangeFor } from '../domain/targets/rangeFor';
import { targetFor } from '../domain/targets/targetFor';
import { titleOf } from '../domain/titles/titleOf';
import type { Player, Pulse, TitleId } from '../domain/types';
import type { GameStore, Unsubscribe } from '../infra/store/GameStore';
import type { Cancel, Scheduler } from '../infra/store/Scheduler';
import type { ServerClock } from '../infra/store/ServerClock';
import { StoreError } from '../infra/store/StoreError';
import { PressBatcher } from './PressBatcher';
import type { Cue, ResultView, RoundEvent, RoundView } from './RoundView';

/** RoundController が使う部品 */
export interface RoundDeps {
  readonly store: GameStore;
  readonly clock: ServerClock;
  readonly scheduler: Scheduler;
  readonly config: GameConfig;
  /** 想定外のエラー(StoreError 以外)を、上に伝える */
  readonly onError: (error: unknown) => void;
}

/** ActiveRound が知らせる先 */
export interface RoundOutlet {
  view(view: RoundView): void;
  event(event: RoundEvent): void;
}

/**
 * 部屋の、いまの回の1回分(RoundController が、回ごとに作り直す)。
 *
 * 数字・参加者・合図を購読して RoundView を組み立て、合図と結果のタイマーを持ち、
 * 押された操作を PressBatcher に渡す。
 */
export class ActiveRound {
  private readonly clockOfRound: RoundClock;
  private readonly unsubscribes: Unsubscribe[] = [];
  private readonly timers: Cancel[] = []; // 合図・段階・結果(時刻が飛んだら組み直す)
  private readonly retries: Cancel[] = []; // やり直し
  private readonly batcher: PressBatcher;
  private players: readonly Player[] = [];
  private titles: Readonly<Record<string, TitleId>> = {};
  private readonly titleRequested = new Set<string>(); // 実績を読みにいった人
  private playersLoaded = false;
  private serverNumber = 0;
  private samples: GraphSample[] = [];
  private pulses: Readonly<Record<string, Pulse>> = {};
  private myPoints = 0;
  private result: ResultView | null = null;
  private settling = false; // 結果を作っている途中
  private closed = false;

  constructor(
    private readonly deps: RoundDeps,
    readonly roomId: number,
    readonly roundId: string,
    private readonly myId: string,
    private readonly out: RoundOutlet
  ) {
    const { store, clock, scheduler, config, onError } = deps;
    this.clockOfRound = roundClockAt(clock.now(), config);
    this.batcher = new PressBatcher(
      { store, clock, scheduler, config, onError },
      {
        roomId,
        roundId,
        playerId: myId,
        playEndsAt: this.clockOfRound.playEndsAt,
      }
    );
    this.unsubscribes.push(
      store.onPlayers(roomId, roundId, (players) =>
        this.updatePlayers(players)
      ),
      store.onNumber(roomId, roundId, (n) => this.updateNumber(n)),
      store.onPulses(roomId, roundId, (pulses) => {
        this.pulses = pulses;
        this.render();
      })
    );
    this.restoreMyPoints();
    this.rearm();
  }

  close(): void {
    this.closed = true;
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    cancelAll(this.timers);
    cancelAll(this.retries);
    this.batcher.stop();
  }

  // ---- view ----

  /**
   * いまの view。参加者の一覧が届くまでは null(プレイ中の目標は、参加者の数で決まるため。
   * 届く前に描くと、目標が0になる)
   */
  view(): RoundView | null {
    if (!this.playersLoaded) {
      return null;
    }
    const { config, clock } = this.deps;
    const now = clock.now();
    const roundClock = roundClockAt(now, config);
    const playerCount =
      roundClock.phase === 'gathering'
        ? displayPlayerCount(
            this.players.filter((p) => p.kind === 'human').length,
            config
          )
        : this.players.length;
    const target = targetFor(playerCount, config);
    const range = rangeFor(target, config);
    const number = this.serverNumber + this.batcher.pendingDelta();
    return {
      roomId: this.roomId,
      roundId: this.roundId,
      clock: roundClock,
      number,
      players: this.players,
      playerCount,
      target,
      lower: range.lower,
      upper: range.upper,
      inRange: isWithinRange(number, range),
      myPoints: this.myPoints,
      bonusActive:
        roundClock.bonusStartsAt <= now && now < roundClock.playEndsAt,
      pulses: this.pulses,
      samples: this.samples,
      titles: this.titles,
      result: this.result,
    };
  }

  private render(): void {
    const view = this.view();
    if (view !== null) {
      this.out.view(view);
    }
  }

  // ---- 購読した値 ----

  private updatePlayers(players: Player[]): void {
    const sorted = [...players].sort(
      (a, b) =>
        a.joinedAt - b.joinedAt || Number(a.id > b.id) - Number(a.id < b.id)
    );
    if (this.playersLoaded) {
      this.announceNewcomers(sorted);
    }
    this.players = sorted;
    this.playersLoaded = true;
    this.loadTitles(sorted);
    this.render();
  }

  /** 新しく来た人間の実績を読んで、称号を決める(1人につき1回。読めなければ出さない) */
  private loadTitles(players: readonly Player[]): void {
    for (const player of players) {
      if (player.kind !== 'human' || this.titleRequested.has(player.id)) {
        continue;
      }
      this.titleRequested.add(player.id);
      void this.deps.store
        .loadStats(player.id)
        .then((stats) => {
          if (!this.closed) {
            const title = titleOf(stats, this.deps.config);
            this.titles = { ...this.titles, [player.id]: title };
            this.render();
          }
        })
        .catch((error: unknown) => this.report(error));
    }
  }

  /** 新しく加わった人の演出(最初の一覧は、演出なし) */
  private announceNewcomers(players: readonly Player[]): void {
    const known = new Set(this.players.map((p) => p.id));
    let count = this.players.length;
    for (const player of players) {
      if (known.has(player.id)) {
        continue;
      }
      if (player.kind === 'ai') {
        this.out.event({ kind: 'fadeIn', player });
      } else if (player.joinedDuring === 'playing') {
        const { config } = this.deps;
        this.out.event({
          kind: 'summon',
          player,
          targetFrom: targetFor(count, config),
          targetTo: targetFor(count + 1, config),
        });
      }
      count += 1;
    }
  }

  private updateNumber(n: number): void {
    const { clock, config } = this.deps;
    const now = clock.now();
    this.serverNumber = n;
    this.samples.push({ t: now, value: n });
    // 窓の始まりより前の標本は、最後の1つだけ残す(graphPoints が、窓の左端につなぐ)
    const windowStart = now - config.pastWindowMs;
    const firstVisible = this.samples.findIndex((s) => s.t >= windowStart);
    if (firstVisible > 1) {
      this.samples = this.samples.slice(firstVisible - 1);
    }
    this.render();
  }

  /** 自分のポイントを読み直す(途中から戻ったとき、0に戻さないため) */
  private restoreMyPoints(): void {
    void this.deps.store
      .readPoints(this.roomId, this.roundId)
      .then((points) => {
        const mine = points[this.myId] ?? 0;
        if (!this.closed && mine > this.myPoints) {
          this.myPoints = mine;
          this.render();
        }
      })
      .catch((error: unknown) => this.report(error));
  }

  // ---- 押す ----

  press(kind: PressKind): void {
    const { clock, config } = this.deps;
    const now = clock.now();
    const { playStartsAt, playEndsAt } = this.clockOfRound;
    if (now < playStartsAt || now >= playEndsAt) {
      return;
    }
    const gain = pointsForPress(
      {
        kind,
        numberAtPress: this.serverNumber + this.batcher.pendingDelta(),
        target: targetFor(this.players.length, config),
        nowMs: now,
        clock: this.clockOfRound,
        currentPoints: this.myPoints,
      },
      config
    );
    this.myPoints += gain;
    this.batcher.press(kind, this.myPoints);
    this.out.event({ kind: 'myPress', press: kind, gain });
    this.render();
  }

  // ---- 時刻 ----

  /** 合図・段階の境目・結果のタイマーを、いまの時刻から組み直す(時刻が飛んだときも呼ぶ) */
  rearm(): void {
    cancelAll(this.timers);
    const { clock, scheduler, config } = this.deps;
    const now = clock.now();
    const { playStartsAt, playEndsAt, bonusStartsAt } = this.clockOfRound;
    const resultAt = playEndsAt + config.pointsGraceMs;
    const at = (time: number, action: () => void) => {
      if (time > now) {
        this.timers.push(scheduler.after(time - now, action));
      }
    };
    const cue = (time: number, name: Cue) =>
      at(time, () => {
        this.out.event({ kind: 'cue', cue: name });
        this.render();
      });

    cue(playStartsAt - config.startCountdownMs, 'start');
    at(playStartsAt, () => this.render()); // 集合中 → ゲーム中(人数の出し方が変わる)
    cue(bonusStartsAt, 'x3');
    cue(playEndsAt - config.finalCountdownMs, 'tenSeconds');
    cue(playEndsAt, 'end');
    if (resultAt > now) {
      at(resultAt, () => void this.settleRound());
    } else {
      void this.settleRound(); // 結果の時刻を過ぎている(戻ったとき・時刻が飛んだとき)
    }
  }

  // ---- 結果 ----

  /** 結果を作る。ポイントを読めなければ、retryMs 後に、次の回の始めまでやり直す */
  private async settleRound(): Promise<void> {
    if (this.result !== null || this.settling) {
      return;
    }
    this.settling = true;
    const { store, config } = this.deps;
    try {
      const points = await store.readPoints(this.roomId, this.roundId);
      const players = this.players;
      const target = targetFor(players.length, config);
      const verdict = judge(this.serverNumber, target, config);
      const listed = players.some((p) => p.id === this.myId);
      const myPoints = Math.max(this.myPoints, points[this.myId] ?? 0);
      const settlement = settle(verdict.outcome, myPoints, config);
      const totalBefore = listed
        ? await this.readTotalBefore(settlement.awarded)
        : null;
      if (this.closed) {
        return;
      }
      this.result = {
        outcome: verdict.outcome,
        missBy: verdict.missBy,
        finalNumber: this.serverNumber,
        target,
        myPoints,
        awarded: settlement.awarded,
        totalBefore,
        ranking: buildRanking(
          players,
          points,
          listed ? this.myId : null,
          config
        ),
      };
      this.render();
      if (listed) {
        void this.saveStats(settlement.statsDelta);
      }
    } catch (error) {
      this.report(error);
      if (error instanceof StoreError) {
        this.retryLater(() => void this.settleRound());
      }
    } finally {
      this.settling = false;
    }
  }

  /**
   * この回を足す前の、自分の累計ポイント(結果発表の「累計 3,420 → 3,724 p」)。
   * もう数えてあれば(途中から戻ったとき)、報酬を引いて戻す。読めなければ null
   */
  private async readTotalBefore(awarded: number): Promise<number | null> {
    try {
      const stats = await this.deps.store.loadStats(this.myId);
      return stats.lastCountedRound === this.roundId
        ? stats.totalPoints - awarded
        : stats.totalPoints;
    } catch (error) {
      this.report(error);
      return null;
    }
  }

  /** 実績を保存する。失敗したら、次の回の始めまで、retryMs ごとにやり直す(結果の表示には影響させない) */
  private async saveStats(delta: StatsDelta): Promise<void> {
    try {
      await this.deps.store.applyStats(this.myId, this.roundId, delta);
    } catch (error) {
      this.report(error);
      if (error instanceof StoreError) {
        this.retryLater(() => void this.saveStats(delta));
      }
    }
  }

  /** retryMs 後に、もう一度試す。次の回の始めを過ぎるなら、あきらめる */
  private retryLater(action: () => void): void {
    const { clock, scheduler, config } = this.deps;
    if (
      !this.closed &&
      clock.now() + config.retryMs < this.clockOfRound.nextRoundStartsAt
    ) {
      this.retries.push(scheduler.after(config.retryMs, action));
    }
  }

  private report(error: unknown): void {
    if (!(error instanceof StoreError)) {
      this.deps.onError(error);
    }
  }
}

function cancelAll(cancels: Cancel[]): void {
  for (const cancel of cancels.splice(0)) {
    cancel();
  }
}
