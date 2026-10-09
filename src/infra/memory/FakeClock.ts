import type { Unsubscribe } from '../store/GameStore';
import type { Cancel, Scheduler } from '../store/Scheduler';
import type { ServerClock } from '../store/ServerClock';

interface Timer {
  readonly id: number;
  dueAt: number;
  readonly intervalMs: number | null; // every のときの間隔。after なら null
  readonly callback: () => void;
}

/**
 * 時刻を決めて進められる ServerClock と Scheduler(テスト・シミュレーション用)。
 *
 * 時計とタイマーを1つにまとめるのは、「時刻を進めたら、その時刻のタイマーが動き、
 * その中の now() も、その時刻」を保つため。
 *
 * - advance: 時計が普通に進んだのと同じ。その間のタイマーを、時刻の順に呼ぶ。知らせない
 * - set: 時刻を飛ばす(サーバー時刻との差が変わったのと同じ)。タイマーは動かさず、onOffsetChange で知らせる
 */
export class FakeClock implements ServerClock, Scheduler {
  private nowMs: number;
  private nextId = 1;
  private readonly timers = new Map<number, Timer>();
  private readonly listeners = new Set<() => void>();

  constructor(startMs: number) {
    this.nowMs = startMs;
  }

  now(): number {
    return this.nowMs;
  }

  onOffsetChange(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  after(ms: number, callback: () => void): Cancel {
    return this.addTimer(ms, null, callback);
  }

  every(ms: number, callback: () => void): Cancel {
    if (!(ms > 0)) {
      throw new RangeError(`every の間隔は正の数にしてください: ${ms}`);
    }
    return this.addTimer(ms, ms, callback);
  }

  private addTimer(
    ms: number,
    intervalMs: number | null,
    callback: () => void
  ): Cancel {
    const id = this.nextId++;
    this.timers.set(id, {
      id,
      dueAt: this.nowMs + Math.max(0, ms),
      intervalMs,
      callback,
    });
    return () => {
      this.timers.delete(id);
    };
  }

  /** 時刻を ms だけ進め、その間に来るタイマーを、時刻の順(同じなら登録の順)に呼ぶ */
  advance(ms: number): void {
    const end = this.nowMs + ms;
    for (;;) {
      const next = this.nextDue(end);
      if (next === undefined) break;
      // set で時刻を先に飛ばしていたら、遅れたタイマーは、いまの時刻で呼ぶ(時刻は戻さない)
      this.nowMs = Math.max(this.nowMs, next.dueAt);
      if (next.intervalMs === null) {
        this.timers.delete(next.id);
      } else {
        next.dueAt = this.nowMs + next.intervalMs; // 遅れても、追いつこうとしない(setInterval と同じ)
      }
      next.callback();
    }
    this.nowMs = end;
  }

  private nextDue(end: number): Timer | undefined {
    let next: Timer | undefined;
    for (const timer of this.timers.values()) {
      if (
        timer.dueAt <= end &&
        (next === undefined ||
          timer.dueAt < next.dueAt ||
          (timer.dueAt === next.dueAt && timer.id < next.id))
      ) {
        next = timer;
      }
    }
    return next;
  }

  /** 時刻を飛ばす(タイマーは動かさない) */
  set(ms: number): void {
    this.nowMs = ms;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
