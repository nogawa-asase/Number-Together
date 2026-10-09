import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentRoundId, waitFor } from '../support/testCycle';
import {
  connectClient,
  disconnectAll,
  readAsOwner,
  resetEmulator,
  until,
} from './world';

beforeEach(resetEmulator);
afterEach(disconnectAll);

describe('AI担当', () => {
  it('最初の人が担当になり、ゲーム開始にAIを1回だけ足す。担当が抜けたら、次の人が引き継いで動かし続ける', async () => {
    // Given: 2人が集合中に入る(本物の AiHost を動かす)
    const a = await connectClient('a', true);
    const b = await connectClient('b', true);
    await waitFor('gathering', 1_500);
    a.session.start();
    await until(() => a.session.state().kind === 'inRoom', 10_000, 'a の入室');
    b.session.start();
    await until(() => b.session.state().kind === 'inRoom', 10_000, 'b の入室');
    const state = a.session.state();
    if (state.kind !== 'inRoom') throw new Error('入室していません');
    const { roomId } = state;
    await until(
      async () => (await readAsOwner(`rooms/${roomId}/aiHost`)) === a.uid(),
      10_000,
      'a が担当になる'
    );

    // When: ゲームが始まる
    await waitFor('playing', 3_000);
    const round = currentRoundId();
    const players = async () =>
      Object.values(
        ((await readAsOwner(`rooms/${roomId}/rounds/${round}/players`)) ??
          {}) as Record<string, { kind: string }>
      );
    await until(
      async () => (await players()).filter((p) => p.kind === 'ai').length === 3,
      5_000,
      'AIが3人加わる'
    );

    // When: 担当が抜ける
    await a.session.stop();
    await until(
      async () => (await readAsOwner(`rooms/${roomId}/aiHost`)) === b.uid(),
      5_000,
      'b が引き継ぐ'
    );

    // Then: AIは足し直されず、数字は動き続ける
    const before = await readAsOwner(`rooms/${roomId}/rounds/${round}/number`);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect((await players()).filter((p) => p.kind === 'ai')).toHaveLength(3);
    expect(
      await readAsOwner(`rooms/${roomId}/rounds/${round}/number`)
    ).not.toBe(before);
    expect([...a.errors, ...b.errors]).toEqual([]);
  }, 60_000);
});
