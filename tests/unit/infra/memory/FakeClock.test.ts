import { describe, expect, it, vi } from 'vitest';
import { FakeClock } from '../../../../src/infra/memory/FakeClock';

describe('FakeClock', () => {
  it('決めた時刻から始まり、進められる', () => {
    const clock = new FakeClock(1_000);
    clock.advance(250);
    expect(clock.now()).toBe(1_250);
  });

  it('進めたときは、知らせない', () => {
    const clock = new FakeClock(0);
    const listener = vi.fn();
    clock.onOffsetChange(listener);
    clock.advance(1_000);
    expect(listener).not.toHaveBeenCalled();
  });

  it('時刻を飛ばしたときは、知らせる', () => {
    const clock = new FakeClock(0);
    const listener = vi.fn();
    clock.onOffsetChange(listener);
    clock.set(5_000);
    expect(clock.now()).toBe(5_000);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('解除したら、知らせない', () => {
    const clock = new FakeClock(0);
    const listener = vi.fn();
    const unsubscribe = clock.onOffsetChange(listener);
    unsubscribe();
    clock.set(5_000);
    expect(listener).not.toHaveBeenCalled();
  });
});
