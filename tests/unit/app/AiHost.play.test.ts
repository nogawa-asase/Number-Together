import { describe, expect, it, vi } from 'vitest';
import { PressBatcher } from '../../../src/app/PressBatcher';
import { advanceSettled, aiHostWorld, settle } from '../fixtures/app';
import {
  GRACE_END,
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

/** 人間1人(AI担当)とAI4人で、1回を終わりまで動かす。人間は押さない */
async function playOneRound(seed = 1) {
  const w = await aiHostWorld(START);
  await w.join(w.host);
  const original = w.host.store.addToNumber.bind(w.host.store);
  const sentAt: number[] = [];
  vi.spyOn(w.host.store, 'addToNumber').mockImplementation((...args) => {
    sentAt.push(w.clock.now());
    return original(...args);
  });
  w.aiHostOf(w.host, seed).start();
  await advanceSettled(w.clock, GRACE_END - START);
  const points = w.server.readPoints(w.host.uid, w.roomId, ROUND);
  return { w, sentAt, points };
}

describe('AiHost: AIの手の送信', () => {
  it('ゲーム中、AIの操作で数字が動き、AIの合図とポイントが書かれる', async () => {
    const { w, sentAt, points } = await playOneRound();
    expect(w.number(ROUND)).not.toBe(0);
    const pulses = w.server.pulsesOf(w.roomId, ROUND);
    for (const ai of w.ais(ROUND)) {
      expect(pulses[ai.id]).toBeDefined();
    }
    expect(Object.keys(points).some((id) => id.startsWith('ai-'))).toBe(true);
    expect(sentAt.length).toBeGreaterThan(0);
    expect(w.server.rejections).toEqual([]);
    expect(w.onError).not.toHaveBeenCalled();
  });

  it('数字は、ゲーム中だけ送る。ゲーム開始より前と、終了の後は送らない', async () => {
    const { sentAt } = await playOneRound();
    expect(Math.min(...sentAt)).toBeGreaterThanOrEqual(PLAY_START);
    expect(Math.max(...sentAt)).toBeLessThan(PLAY_END);
  });

  it('AIのポイントは、人間と同じ計算: 倍増タイム中に範囲の中で+1を押せば3ポイント、−1は0ポイント', async () => {
    const start = PLAY_END - 20_000; // 終了の前20秒は、倍増タイム
    const w = await aiHostWorld(start);
    await w.join(w.host);
    for (let i = 0; i < 20; i++) {
      await w.host.store.addToNumber(w.roomId, ROUND, 50); // 数字を目標(1,000)にしておく
    }
    const press = vi.spyOn(PressBatcher.prototype, 'press');
    w.aiHostOf(w.host).start();
    w.clock.advance(GRACE_END - start);
    await settle();

    const totals = new Map<PressBatcher, number>();
    const gains = { '+1': new Set<number>(), '-1': new Set<number>() };
    for (const [i, [kind, total]] of press.mock.calls.entries()) {
      const batcher = press.mock.contexts[i] as PressBatcher;
      gains[kind].add(total - (totals.get(batcher) ?? 0));
      totals.set(batcher, total);
    }
    expect(gains['+1']).toContain(3);
    expect([...gains['+1']].every((g) => g === 1 || g === 3)).toBe(true);
    expect([...gains['-1']].every((g) => g === 0)).toBe(true);

    const points = w.server.readPoints(w.host.uid, w.roomId, ROUND);
    const byValue = (a: number, b: number) => a - b;
    expect(Object.values(points).sort(byValue)).toEqual(
      [...totals.values()].sort(byValue)
    );
  });

  it('乱数の種が同じなら、同じ結果になる', async () => {
    const a = await playOneRound(7);
    const b = await playOneRound(7);
    expect(b.w.number(ROUND)).toBe(a.w.number(ROUND));
    expect(b.points).toEqual(a.points);
    expect(b.sentAt).toEqual(a.sentAt);
    const c = await playOneRound(8);
    expect(c.sentAt).not.toEqual(a.sentAt);
  });

  it('次の回にも続けて、AIを足して動かす', async () => {
    const { w } = await playOneRound();
    w.clock.advance(NEXT_START - GRACE_END);
    await w.join(w.host);
    w.clock.advance(60_000);
    await settle();
    const next = String(Number(ROUND) + 1);
    expect(w.ais(next)).toHaveLength(4);
    expect(w.number(next)).not.toBe(0);
    expect(w.server.rejections).toEqual([]);
  });
});
