import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemClock } from '../../../../src/infra/timer/SystemClock';

afterEach(() => {
  vi.useRealTimers();
});

describe('SystemClock', () => {
  it('端末の時計を、そのまま返す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(123_456);
    expect(new SystemClock().now()).toBe(123_456);
  });

  it('差は変わらないので、知らせない(解除の関数は返す)', () => {
    const off = new SystemClock().onOffsetChange();
    expect(off).not.toThrow();
  });
});
