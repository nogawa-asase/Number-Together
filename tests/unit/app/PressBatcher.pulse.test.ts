import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import { batcherWorld, settle } from '../fixtures/app';
import { PLAY_START } from '../fixtures/memoryStore';

/** sendPulse の呼び出しを、[送った時刻(PLAY_START から), power] にする */
async function recordPulses(w: Awaited<ReturnType<typeof batcherWorld>>) {
  const sent: [number, number][] = [];
  vi.spyOn(w.me.store, 'sendPulse').mockImplementation(
    async (_r, _round, _p, power) => {
      sent.push([w.clock.now() - PLAY_START, power]);
    }
  );
  return sent;
}

describe('PressBatcher: 合図', () => {
  it('最初に押したときは、すぐ送る', async () => {
    const w = await batcherWorld();
    const sent = await recordPulses(w);
    w.batcher.press('+1', 0);
    expect(sent).toEqual([[0, 1]]);
  });

  it('1秒に1回まで。続けて押した分は、前の合図の1秒後に、まとめて1回', async () => {
    const w = await batcherWorld();
    const sent = await recordPulses(w);
    w.batcher.press('+1', 0); // 0ms: すぐ送る
    for (let i = 0; i < 4; i++) {
      w.clock.advance(100);
      w.batcher.press('+1', 0); // 100〜400ms: 予約(1回だけ)
    }
    w.clock.advance(1_000);
    await settle();
    // 1,000ms の時点で、直近1秒(0ms を含まない)に押したのは4回 → 強さ2
    expect(sent).toEqual([
      [0, 1],
      [1_000, 2],
    ]);
  });

  it('強さは、直近1秒に押した回数で決まる(6回以上で3)', async () => {
    const w = await batcherWorld();
    const sent = await recordPulses(w);
    w.batcher.press('+1', 0);
    for (let i = 0; i < 6; i++) {
      w.clock.advance(100);
      w.batcher.press('-1', 0); // −1も数える
    }
    w.clock.advance(1_000);
    expect(sent.at(-1)).toEqual([1_000, 3]);
  });

  it('押さなければ、送らない', async () => {
    const w = await batcherWorld();
    const sent = await recordPulses(w);
    w.batcher.press('+1', 0);
    w.clock.advance(10_000);
    expect(sent).toEqual([[0, 1]]);
  });

  it('前の合図から1秒たっていれば、また、すぐ送る', async () => {
    const w = await batcherWorld();
    const sent = await recordPulses(w);
    w.batcher.press('+1', 0);
    w.clock.advance(1_000);
    w.batcher.press('+1', 0);
    expect(sent).toEqual([
      [0, 1],
      [1_000, 1],
    ]);
  });

  it('強さが0になる回数なら、送らない(段階の設定しだい)', async () => {
    const config = { ...DEFAULT_CONFIG, pulsePowerSteps: [2, 3, 6] as const };
    const w = await batcherWorld(PLAY_START, config);
    const sent = await recordPulses(w);
    w.batcher.press('+1', 0);
    expect(sent).toEqual([]);
  });

  it('合図は、サーバーに届く(t はサーバー時刻)', async () => {
    const w = await batcherWorld();
    w.batcher.press('+1', 0);
    await settle();
    expect(w.pulses()).toEqual({ t: PLAY_START, power: 1 });
  });
});
