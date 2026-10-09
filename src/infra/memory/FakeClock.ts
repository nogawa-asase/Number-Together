import type { Unsubscribe } from '../store/GameStore';
import type { ServerClock } from '../store/ServerClock';

/**
 * 時刻を決めて進められる ServerClock(テスト・シミュレーション用)。
 *
 * - advance: 時計が普通に進んだのと同じ。知らせない
 * - set: 時刻を飛ばす(サーバー時刻との差が変わったのと同じ)。onOffsetChange で知らせる
 */
export class FakeClock implements ServerClock {
  private nowMs: number;
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

  /** 時刻を ms だけ進める */
  advance(ms: number): void {
    this.nowMs += ms;
  }

  /** 時刻を飛ばす */
  set(ms: number): void {
    this.nowMs = ms;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
