import type { GameConfig } from '../domain/config/types';
import type { PressKind } from '../domain/points/types';
import { pulsePowerFor } from '../domain/pulses/pulsePowerFor';
import type { GameStore } from '../infra/store/GameStore';
import type { Cancel, Scheduler } from '../infra/store/Scheduler';
import type { ServerClock } from '../infra/store/ServerClock';
import { StoreError } from '../infra/store/StoreError';

/** PressBatcher が使う部品 */
export interface PressBatcherDeps {
  readonly store: GameStore;
  readonly clock: ServerClock;
  readonly scheduler: Scheduler;
  readonly config: GameConfig;
  /** 想定外のエラー(StoreError 以外)を、上に伝える */
  readonly onError: (error: unknown) => void;
}

/** 誰の操作を、どの回に送るか */
export interface PressSlot {
  readonly roomId: number;
  readonly roundId: string;
  readonly playerId: string; // 人間は自分の uid、AIは 'ai-1' など
  readonly playEndsAt: number; // この時刻から、数字と合図を送らない
}

/**
 * 連打のまとめ送り(docs/functional-design.md「PressBatcher」)。
 *
 * - 押された分を積み、batchMs(0.2秒)ごとに、1回の加算として送る。1回は ±maxDeltaPerWrite まで。残りは次へ
 * - 貯めたポイントが増えていれば、あわせて書く
 * - 合図は pulseIntervalMs(1秒)に1回まで。押したとき、前の合図から1秒たっていれば、すぐ送る
 * - ゲーム終了の時刻を過ぎたら、数字と合図を送るのをやめ、ポイントを最後に1回書く
 * - 切断などで送れなかった分は、次の送信でやり直す
 *
 * 人間の操作(RoundController)と、AIの操作(AiHost)の両方で使う。
 */
export class PressBatcher {
  private pending = 0;
  private totalPoints = 0;
  private writtenPoints = 0;
  private pointsInFlight = false;
  private pressTimes: number[] = [];
  private lastPulseAt = Number.NEGATIVE_INFINITY;
  private cancelPulse: Cancel | null = null;
  private readonly cancelBatch: Cancel;
  private stopped = false;

  constructor(
    private readonly deps: PressBatcherDeps,
    private readonly slot: PressSlot
  ) {
    this.cancelBatch = deps.scheduler.every(deps.config.batchMs, () =>
      this.flush()
    );
  }

  /**
   * 押された。
   *
   * @param kind - +1 か −1
   * @param totalPoints - 押したあとの、この回で貯めたポイントの合計(pointsForPress で、呼ぶ側が計算する)
   */
  press(kind: PressKind, totalPoints: number): void {
    const now = this.deps.clock.now();
    if (this.stopped || now >= this.slot.playEndsAt) {
      return;
    }
    this.pending += kind === '+1' ? 1 : -1;
    this.totalPoints = Math.max(this.totalPoints, totalPoints);
    this.pressTimes.push(now);
    this.schedulePulse(now);
  }

  /** まだ送っていない分(画面の数字に足す) */
  pendingDelta(): number {
    return this.pending;
  }

  /** 止める(回が終わった、部屋を出た)。この後は、何も送らない */
  stop(): void {
    this.finish(false);
  }

  // ---- 数字とポイント ----

  private flush(): void {
    if (this.deps.clock.now() >= this.slot.playEndsAt) {
      this.finish(true);
      return;
    }
    const max = this.deps.config.maxDeltaPerWrite;
    const delta = Math.max(-max, Math.min(max, this.pending));
    if (delta !== 0) {
      this.pending -= delta;
      const { roomId, roundId } = this.slot;
      void this.send(
        this.deps.store.addToNumber(roomId, roundId, delta),
        () => {
          this.pending += delta; // 送れなかった分は、次の送信で
        }
      );
    }
    this.writePoints();
  }

  private writePoints(): void {
    if (this.pointsInFlight || this.totalPoints <= this.writtenPoints) {
      return;
    }
    const value = this.totalPoints;
    const { roomId, roundId, playerId } = this.slot;
    this.pointsInFlight = true;
    void this.send(
      this.deps.store.writePoints(roomId, roundId, playerId, value).then(() => {
        this.writtenPoints = Math.max(this.writtenPoints, value);
      }),
      () => {} // 書けなかったら、次の送信で書き直す(writtenPoints を進めない)
    ).finally(() => {
      this.pointsInFlight = false;
    });
  }

  // ---- 合図 ----

  private schedulePulse(now: number): void {
    if (this.cancelPulse !== null) {
      return; // もう予約してある
    }
    const wait = this.lastPulseAt + this.deps.config.pulseIntervalMs - now;
    if (wait <= 0) {
      this.sendPulse();
      return;
    }
    this.cancelPulse = this.deps.scheduler.after(wait, () => {
      this.cancelPulse = null;
      this.sendPulse();
    });
  }

  private sendPulse(): void {
    const now = this.deps.clock.now();
    if (now >= this.slot.playEndsAt) {
      return;
    }
    const since = now - this.deps.config.pulseIntervalMs;
    this.pressTimes = this.pressTimes.filter((t) => t > since);
    const power = pulsePowerFor(this.pressTimes.length, this.deps.config);
    if (power === 0) {
      return;
    }
    this.lastPulseAt = now;
    const { roomId, roundId, playerId } = this.slot;
    void this.send(
      this.deps.store.sendPulse(roomId, roundId, playerId, power),
      () => {} // 合図は、失われてもよい(次に押したときに、また送る)
    );
  }

  // ---- 終わりとエラー ----

  private finish(byPlayEnd: boolean): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.cancelBatch();
    this.cancelPulse?.();
    this.cancelPulse = null;
    this.pending = 0; // 終了の直前の、まだ送っていない分は、失われる(ルールで受け付けない)
    if (byPlayEnd) {
      // ポイントは、終了の pointsGraceMs(3秒)後まで書けるので、最後に1回書く
      this.pointsInFlight = false;
      this.writePoints();
    }
  }

  /** 送る。StoreError なら onStoreError、それ以外は onError に伝える */
  private send(
    promise: Promise<void>,
    onStoreError: () => void
  ): Promise<void> {
    return promise.catch((error: unknown) => {
      if (error instanceof StoreError) {
        onStoreError();
      } else {
        this.deps.onError(error);
      }
    });
  }
}
