import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { currentRoundId, waitFor } from '../support/testCycle';
import {
  connectClient,
  disconnectAll,
  readAsOwner,
  resetEmulator,
} from './world';

beforeEach(resetEmulator);
afterEach(disconnectAll);

describe('同時に押しても、取りこぼさない', () => {
  it('5人が同時に何度も足し引きしても、最終の数字は、全員の合計と一致する', async () => {
    // Given: 5人が同じ部屋にいる
    const clients = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((name) => connectClient(name))
    );
    const roomId = await clients[0]!.store.createRoom(clients[0]!.uid());
    for (const client of clients.slice(1)) {
      expect(await client.store.tryEnterRoom(roomId, client.uid(), 20)).toBe(
        true
      );
    }

    // When: ゲーム中に、全員が同時に、+3 を20回、−1 を5回ずつ送る
    await waitFor('playing', 4_000);
    const round = currentRoundId();
    await Promise.all(
      clients.flatMap((client) => [
        ...Array.from({ length: 20 }, () =>
          client.store.addToNumber(roomId, round, 3)
        ),
        ...Array.from({ length: 5 }, () =>
          client.store.addToNumber(roomId, round, -1)
        ),
      ])
    );

    // Then
    expect(await readAsOwner(`rooms/${roomId}/rounds/${round}/number`)).toBe(
      5 * (20 * 3 - 5)
    );
  }, 60_000);
});
