import { describe, expect, it, vi } from 'vitest';
import { batcherWorld, settle } from '../fixtures/app';

describe('PressBatcher: まとめ送り', () => {
  it('0.2秒の間の連打は、1回の加算にまとまる', async () => {
    const w = await batcherWorld();
    const add = vi.spyOn(w.me.store, 'addToNumber');
    for (let i = 0; i < 5; i++) w.batcher.press('+1', 0);

    w.clock.advance(199);
    expect(add).not.toHaveBeenCalled();
    w.clock.advance(1);
    await settle();

    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(w.roomId, '4928211', 5);
    expect(w.number()).toBe(5);
  });

  it('+1と−1は打ち消し合い、差し引き0なら送らない', async () => {
    const w = await batcherWorld();
    const add = vi.spyOn(w.me.store, 'addToNumber');
    w.batcher.press('+1', 0);
    w.batcher.press('-1', 0);
    w.clock.advance(200);
    await settle();
    expect(add).not.toHaveBeenCalled();
  });

  it('−1が多ければ、負の加算として送る', async () => {
    const w = await batcherWorld();
    for (let i = 0; i < 3; i++) w.batcher.press('-1', 0);
    w.clock.advance(200);
    await settle();
    expect(w.number()).toBe(-3);
  });

  it('0.2秒に51回押すと、1回目は50、残りの1は次の送信に回る', async () => {
    const w = await batcherWorld();
    const add = vi.spyOn(w.me.store, 'addToNumber');
    for (let i = 0; i < 51; i++) w.batcher.press('+1', 0);

    w.clock.advance(200);
    await settle();
    expect(add.mock.calls.map((call) => call[2])).toEqual([50]);
    expect(w.batcher.pendingDelta()).toBe(1);

    w.clock.advance(200);
    await settle();
    expect(add.mock.calls.map((call) => call[2])).toEqual([50, 1]);
    expect(w.number()).toBe(51);
  });

  it('−1を120回押すと、−50・−50・−20 に分けて送る', async () => {
    const w = await batcherWorld();
    const add = vi.spyOn(w.me.store, 'addToNumber');
    for (let i = 0; i < 120; i++) w.batcher.press('-1', 0);
    w.clock.advance(600);
    await settle();
    expect(add.mock.calls.map((call) => call[2])).toEqual([-50, -50, -20]);
  });

  it('pendingDelta は、まだ送っていない分', async () => {
    const w = await batcherWorld();
    w.batcher.press('+1', 0);
    w.batcher.press('+1', 0);
    expect(w.batcher.pendingDelta()).toBe(2);
    w.clock.advance(200);
    expect(w.batcher.pendingDelta()).toBe(0);
  });

  it('ポイントは、増えたときだけ書く', async () => {
    const w = await batcherWorld();
    const write = vi.spyOn(w.me.store, 'writePoints');
    w.batcher.press('+1', 1);
    w.batcher.press('+1', 2);
    w.clock.advance(200);
    await settle();
    expect(w.points()).toBe(2);

    w.batcher.press('-1', 2); // −1はポイントが増えない
    w.clock.advance(200);
    await settle();
    expect(write).toHaveBeenCalledTimes(1);

    w.batcher.press('+1', 5);
    w.clock.advance(200);
    await settle();
    expect(w.points()).toBe(5);
  });

  it('ポイントの合計が前より小さく渡されても、減らさない', async () => {
    const w = await batcherWorld();
    w.batcher.press('+1', 4);
    w.batcher.press('+1', 3);
    w.clock.advance(200);
    await settle();
    expect(w.points()).toBe(4);
  });
});
