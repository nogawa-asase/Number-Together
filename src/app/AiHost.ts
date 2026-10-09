import { aiViewAt, reactionDelayMs } from '../domain/ai/aiView';
import type { AiParams } from '../domain/ai/aiParams';
import { decide } from '../domain/ai/decide';
import {
  AI_PERSONALITIES,
  pickPersonalities,
} from '../domain/ai/pickPersonalities';
import type { Random } from '../domain/ai/random';
import type { GameConfig } from '../domain/config/types';
import { pointsForPress } from '../domain/points/pointsForPress';
import { roundClockAt, roundId } from '../domain/schedule/roundClockAt';
import type { RoundClock } from '../domain/schedule/types';
import { targetFor } from '../domain/targets/targetFor';
import type { AiPersonality, Player } from '../domain/types';
import type { GameStore, Unsubscribe } from '../infra/store/GameStore';
import type { Cancel, Scheduler } from '../infra/store/Scheduler';
import type { ServerClock } from '../infra/store/ServerClock';
import { StoreError } from '../infra/store/StoreError';
import { PressBatcher } from './PressBatcher';

/** AiHost が使う部品 */
export interface AiHostDeps {
  readonly store: GameStore;
  readonly clock: ServerClock;
  readonly scheduler: Scheduler;
  readonly config: GameConfig;
  readonly aiParams: AiParams;
  readonly random: Random; // AIの性格・反応の遅れ・手の選択に使う
  /** 想定外のエラー(StoreError 以外)を、上に伝える */
  readonly onError: (error: unknown) => void;
}

/** どの部屋の、誰のブラウザか */
export interface AiHostSeat {
  readonly roomId: number;
  readonly uid: string;
}

/** 受け持っているAI1人分 */
interface AiSeat {
  readonly id: string;
  readonly personality: AiPersonality;
  readonly delayMs: number; // 反応の遅れ。この時間だけ前の数字を見る
  readonly batcher: PressBatcher;
  points: number; // この担当が数えた、この回のポイント
}

/** 届いた数字の記録 */
interface NumberAt {
  readonly t: number;
  readonly n: number;
}

const isPersonality = (value: unknown): value is AiPersonality =>
  AI_PERSONALITIES.includes(value as AiPersonality);

/** id の順(並びを決めて、乱数の使い方を毎回同じにする) */
const byId = (a: { id: string }, b: { id: string }): number =>
  Number(a.id > b.id) - Number(a.id < b.id);

/**
 * AIの操作を代わりに送る(docs/functional-design.md「AiHost」「7. AI担当と、AIの手」)。
 *
 * 部屋の aiHost を購読し、自分が AI担当のあいだだけ動く(担当を取りにいくのは SessionController)。
 *
 * - ゲーム開始の時刻に、人間が aiFillTo 人に足りなければ、AIを足す。ゲーム中に担当になり、
 *   その回にAIがいなければ、その時点で足す
 * - ゲーム中、tickMs ごとに、AIごとに decide で手を選び、pointsForPress でポイントを数え、
 *   AIごとの PressBatcher で送る(人間と同じ形)
 * - 回の始めと、担当になったときに、roundsToKeep より古い回を消す
 */
export class AiHost {
  private unsubscribeHost: Unsubscribe | null = null;
  private round: AiRound | null = null;
  private cancelNextRound: Cancel | null = null;

  constructor(
    private readonly deps: AiHostDeps,
    private readonly seat: AiHostSeat
  ) {}

  /** 部屋の aiHost を購読する。自分が担当なら、動く */
  start(): void {
    if (this.unsubscribeHost !== null) {
      return;
    }
    this.unsubscribeHost = this.deps.store.onAiHost(this.seat.roomId, (uid) => {
      if (uid === this.seat.uid) {
        this.activate();
      } else {
        this.deactivate();
      }
    });
  }

  /** 止める(部屋を出た)。この後は、何も送らない */
  stop(): void {
    this.unsubscribeHost?.();
    this.unsubscribeHost = null;
    this.deactivate();
  }

  /** いま、AI担当として動いているか */
  isActive(): boolean {
    return this.round !== null;
  }

  private activate(): void {
    if (this.round === null) {
      this.enterRound();
    }
  }

  private deactivate(): void {
    this.leaveRound();
  }

  private leaveRound(): void {
    this.cancelNextRound?.();
    this.cancelNextRound = null;
    this.round?.stop();
    this.round = null;
  }

  private enterRound(): void {
    const now = this.deps.clock.now();
    const clock = roundClockAt(now, this.deps.config);
    this.deleteOldRound(clock.roundIndex);
    this.round = new AiRound(this.deps, this.seat, clock);
    this.cancelNextRound = this.deps.scheduler.after(
      clock.nextRoundStartsAt - now,
      () => {
        this.leaveRound();
        this.enterRound();
      }
    );
  }

  /** roundsToKeep より古くなった回を消す(残すのは、いまの回を含めて roundsToKeep 回分) */
  private deleteOldRound(roundIndex: number): void {
    const oldIndex = roundIndex - this.deps.config.roundsToKeep;
    if (oldIndex < 0) {
      return;
    }
    void this.deps.store
      .deleteRound(this.seat.roomId, roundId(oldIndex))
      .catch(ignoreStoreError(this.deps.onError));
  }
}

/** AI担当の、1回分の動き */
class AiRound {
  private readonly roundId: string;
  private readonly unsubscribes: Unsubscribe[] = [];
  private readonly cancels: Cancel[] = [];
  private readonly ais = new Map<string, AiSeat>();
  private players: readonly Player[] = [];
  private playersLoaded = false; // players が1回でも届いたか
  // 届いた数字。届く前は0(データベースに、まだ数字がない)
  private numbers: NumberAt[] = [{ t: Number.NEGATIVE_INFINITY, n: 0 }];
  private playing = false;
  private started = false; // AIの追加を試し、tick を始めたか
  private readonly fromGathering: boolean; // ゲーム開始の前から担当だったか

  constructor(
    private readonly deps: AiHostDeps,
    private readonly seat: AiHostSeat,
    private readonly clock: RoundClock
  ) {
    this.roundId = roundId(clock.roundIndex);
    const { store } = deps;
    const { roomId } = seat;
    const now = deps.clock.now();
    this.fromGathering = now < clock.playStartsAt;

    this.unsubscribes.push(
      store.onPlayers(roomId, this.roundId, (players) => {
        this.players = players;
        this.playersLoaded = true;
        this.update();
      }),
      store.onNumber(roomId, this.roundId, (n) => {
        this.recordNumber(n);
      })
    );

    if (this.fromGathering) {
      this.cancels.push(
        deps.scheduler.after(clock.playStartsAt - now, () => this.startPlay())
      );
    } else if (now < clock.playEndsAt) {
      this.startPlay();
    }
  }

  stop(): void {
    for (const cancel of this.cancels) {
      cancel();
    }
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    for (const ai of this.ais.values()) {
      ai.batcher.stop();
    }
  }

  private startPlay(): void {
    this.playing = true;
    this.update();
  }

  /**
   * players か段階が変わった。ゲーム中で players が届いていれば、
   * 初めてのときだけ、AIの追加を試して tick を始める。そのうえで、新しいAIを受け持つ
   */
  private update(): void {
    if (!this.playing || !this.playersLoaded) {
      return;
    }
    if (!this.started) {
      this.started = true;
      this.fillAis(this.players); // 追加したAIは、players の変化で受け持つ
      this.cancels.push(
        this.deps.scheduler.every(this.deps.aiParams.tickMs, () => this.tick())
      );
    }
    this.adoptAis(this.players);
  }

  // ---- AIの追加 ----

  private fillAis(players: readonly Player[]): void {
    if (players.some((p) => p.kind === 'ai')) {
      return; // その回のAIは、もう足してある(引き継ぎ)
    }
    const selfListed = players.some((p) => p.id === this.seat.uid);
    const humans =
      players.filter((p) => p.kind === 'human').length + (selfListed ? 0 : 1);
    const count = this.deps.config.aiFillTo - humans;
    if (count <= 0) {
      return;
    }
    const joinedDuring = this.fromGathering ? 'gathering' : 'playing';
    const personalities = pickPersonalities(count, this.deps.random);
    personalities.forEach((personality, i) => {
      const player: Player = {
        id: `ai-${i + 1}`,
        kind: 'ai',
        uid: null,
        name: '',
        character: null,
        personality,
        joinedAt: this.deps.clock.now(), // サーバーが書き直す
        joinedDuring,
      };
      void this.deps.store
        .addPlayer(this.seat.roomId, this.roundId, player)
        .catch(ignoreStoreError(this.deps.onError));
    });
  }

  /** まだ受け持っていないAIを、受け持つ(id の順) */
  private adoptAis(players: readonly Player[]): void {
    const newcomers = players
      .filter((p) => p.kind === 'ai' && !this.ais.has(p.id))
      .sort(byId);
    for (const player of newcomers) {
      const { personality } = player;
      if (!isPersonality(personality)) {
        continue; // 他の人が書いた値なので、使う側で検証する
      }
      const batcher = new PressBatcher(
        {
          store: this.deps.store,
          clock: this.deps.clock,
          scheduler: this.deps.scheduler,
          config: this.deps.config,
          onError: this.deps.onError,
        },
        {
          roomId: this.seat.roomId,
          roundId: this.roundId,
          playerId: player.id,
          playEndsAt: this.clock.playEndsAt,
        }
      );
      this.ais.set(player.id, {
        id: player.id,
        personality,
        delayMs: reactionDelayMs(this.deps.random, this.deps.aiParams),
        batcher,
        points: 0, // 引き継いだときも0から(前の担当の値は、ルールで読めない)
      });
    }
  }

  // ---- AIの手 ----

  private tick(): void {
    const now = this.deps.clock.now();
    if (now >= this.clock.playEndsAt) {
      return;
    }
    const { config, aiParams, random } = this.deps;
    const target = targetFor(this.players.length, config);
    const current = this.numberAt(now);
    for (const ai of [...this.ais.values()].sort(byId)) {
      const view = aiViewAt(
        {
          number: this.numberAt(now - ai.delayMs),
          target,
          nowMs: now,
          clock: this.clock,
        },
        config
      );
      const move = decide(
        ai.personality,
        view,
        aiParams.tickMs,
        random,
        aiParams
      );
      if (move === null) {
        continue;
      }
      ai.points += pointsForPress(
        {
          kind: move,
          numberAtPress: current + ai.batcher.pendingDelta(),
          target,
          nowMs: now,
          clock: this.clock,
          currentPoints: ai.points,
        },
        config
      );
      ai.batcher.press(move, ai.points);
    }
  }

  // ---- 遅れた数字 ----

  private recordNumber(n: number): void {
    const now = this.deps.clock.now();
    this.numbers.push({ t: now, n });
    // 最大の遅れより前の記録は、最後の1つだけ残す(どの AI が見る時刻よりも前なので、それで足りる)
    const horizon = now - this.deps.aiParams.reactionDelayMaxMs;
    const firstRecent = this.numbers.findIndex((r) => r.t > horizon);
    if (firstRecent > 1) {
      this.numbers = this.numbers.slice(firstRecent - 1);
    }
  }

  /** 時刻 t に見えていた数字(t までに、最後に届いた値) */
  private numberAt(t: number): number {
    let seen = 0;
    for (const record of this.numbers) {
      if (record.t > t) {
        break;
      }
      seen = record.n;
    }
    return seen;
  }
}

/** StoreError(切断など)は無視し、それ以外は onError に伝える */
function ignoreStoreError(onError: (error: unknown) => void) {
  return (error: unknown): void => {
    if (!(error instanceof StoreError)) {
      onError(error);
    }
  };
}
