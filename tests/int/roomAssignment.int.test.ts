import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_CONFIG, waitFor } from '../support/testCycle';
import {
  connectClient,
  disconnectAll,
  readAsOwner,
  resetEmulator,
  until,
} from './world';

beforeEach(resetEmulator);
afterEach(disconnectAll);

describe('部屋の割り振り', () => {
  it('25人がほぼ同時に入っても、1部屋は20人を超えず、あふれた人は新しい部屋に入る', async () => {
    // Given: 25人(サインインと名前の保存は、先に済ませておく)
    const clients = await Promise.all(
      Array.from({ length: 25 }, (_, i) => connectClient(`p${i}`))
    );

    // When: 集合中に、全員が同時に始める
    await waitFor('gathering', 1_500);
    for (const client of clients) {
      client.session.start();
    }
    await until(
      () => clients.every((c) => c.session.state().kind === 'inRoom'),
      30_000, // 集合中に作れなかった人は、次の回の集合で入る
      '全員の入室'
    );

    // Then: 部屋ごとの人数(参加中の印と、人数の数え)が20人以下で、合計25人
    const rooms = new Map<number, number>();
    for (const client of clients) {
      const state = client.session.state();
      if (state.kind === 'inRoom') {
        rooms.set(state.roomId, (rooms.get(state.roomId) ?? 0) + 1);
      }
    }
    expect(
      [...rooms.values()].every((n) => n <= TEST_CONFIG.roomCapacity)
    ).toBe(true);
    expect([...rooms.values()].reduce((a, b) => a + b, 0)).toBe(25);
    expect(rooms.size).toBeGreaterThanOrEqual(2);
    for (const [roomId, members] of rooms) {
      const presence = (await readAsOwner(
        `rooms/${roomId}/presence`
      )) as object;
      expect(Object.keys(presence)).toHaveLength(members);
      expect(await readAsOwner(`rooms/${roomId}/memberCount`)).toBe(members);
    }
    expect(clients.flatMap((c) => c.errors)).toEqual([]);
  }, 90_000);
});
