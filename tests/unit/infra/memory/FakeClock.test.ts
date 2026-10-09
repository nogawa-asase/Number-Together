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

describe('FakeClock のタイマー', () => {
  it('after は、その時刻に1回だけ呼ぶ。中の now() も、その時刻', () => {
    const clock = new FakeClock(0);
    const seen: number[] = [];
    clock.after(300, () => seen.push(clock.now()));

    clock.advance(299);
    expect(seen).toEqual([]);
    clock.advance(1);
    expect(seen).toEqual([300]);
    clock.advance(1_000);
    expect(seen).toEqual([300]);
  });

  it('every は、間隔ごとに呼ぶ', () => {
    const clock = new FakeClock(0);
    const seen: number[] = [];
    clock.every(200, () => seen.push(clock.now()));
    clock.advance(1_000);
    expect(seen).toEqual([200, 400, 600, 800, 1_000]);
    expect(clock.now()).toBe(1_000);
  });

  it('複数のタイマーは、時刻の順、同じ時刻なら登録の順に呼ぶ', () => {
    const clock = new FakeClock(0);
    const seen: string[] = [];
    clock.every(200, () => seen.push(`b${clock.now()}`));
    clock.after(300, () => seen.push(`a${clock.now()}`));
    clock.after(200, () => seen.push(`c${clock.now()}`));
    clock.advance(400);
    expect(seen).toEqual(['b200', 'c200', 'a300', 'b400']);
  });

  it('止めたタイマーは呼ばない。呼ばれた中で止めることもできる', () => {
    const clock = new FakeClock(0);
    const seen: number[] = [];
    const cancelA = clock.after(100, () => seen.push(1));
    cancelA();
    const cancelB = clock.every(100, () => {
      seen.push(2);
      cancelB();
    });
    clock.advance(1_000);
    expect(seen).toEqual([2]);
  });

  it('呼ばれた中で登録したタイマーも、進める範囲の中なら呼ぶ', () => {
    const clock = new FakeClock(0);
    const seen: number[] = [];
    clock.after(100, () => {
      clock.after(50, () => seen.push(clock.now()));
    });
    clock.advance(200);
    expect(seen).toEqual([150]);
  });

  it('0以下の遅れの after は、次に進めたときにすぐ呼ぶ', () => {
    const clock = new FakeClock(500);
    const seen: number[] = [];
    clock.after(-10, () => seen.push(clock.now()));
    clock.advance(0);
    expect(seen).toEqual([500]);
  });

  it('every の間隔が0以下なら、RangeError(終わらなくなるため)', () => {
    const clock = new FakeClock(0);
    expect(() => clock.every(0, () => {})).toThrow(RangeError);
  });

  it('set で時刻を飛ばしても、タイマーは動かない', () => {
    const clock = new FakeClock(0);
    const seen: number[] = [];
    clock.after(100, () => seen.push(clock.now()));
    clock.set(1_000);
    expect(seen).toEqual([]);
    clock.advance(0);
    expect(seen).toEqual([1_000]);
  });

  it('set で飛ばしたあと、遅れた every は1回だけ呼び、そこから間隔を数える', () => {
    const clock = new FakeClock(0);
    const seen: number[] = [];
    clock.every(200, () => seen.push(clock.now()));
    clock.set(1_000);
    clock.advance(200);
    expect(seen).toEqual([1_000, 1_200]);
  });
});
