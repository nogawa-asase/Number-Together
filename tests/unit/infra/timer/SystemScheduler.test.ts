import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemScheduler } from '../../../../src/infra/timer/SystemScheduler';

describe('SystemScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('after は、その時間のあとに1回呼ぶ。止めたら呼ばない', () => {
    const scheduler = new SystemScheduler();
    const a = vi.fn();
    const b = vi.fn();
    scheduler.after(300, a);
    scheduler.after(300, b)();

    vi.advanceTimersByTime(299);
    expect(a).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it('every は、間隔ごとに呼ぶ。止めたら呼ばない', () => {
    const scheduler = new SystemScheduler();
    const callback = vi.fn();
    const cancel = scheduler.every(200, callback);

    vi.advanceTimersByTime(1_000);
    expect(callback).toHaveBeenCalledTimes(5);
    cancel();
    vi.advanceTimersByTime(1_000);
    expect(callback).toHaveBeenCalledTimes(5);
  });
});
