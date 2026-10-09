import { vi } from 'vitest';
import { PressBatcher } from '../../../src/app/PressBatcher';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import type { GameConfig } from '../../../src/domain/config/types';
import { memoryWorld, PLAY_END, PLAY_START, ROUND } from './memoryStore';
import { humanOf } from './players';

/** たまっている約束(Promise)の続きを、すべて動かす */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 部屋に入って参加者になった人の PressBatcher を作る。
 * 時計とタイマーは同じ FakeClock(advance で、その間の送信が動く)
 */
export async function batcherWorld(
  startMs = PLAY_START,
  config: GameConfig = DEFAULT_CONFIG
) {
  const world = memoryWorld(startMs, config);
  const me = await world.connect();
  const roomId = await me.store.createRoom(me.uid);
  await me.store.addPlayer(roomId, ROUND, humanOf(me.uid));
  const onError = vi.fn();
  const batcher = new PressBatcher(
    {
      store: me.store,
      clock: world.clock,
      scheduler: world.clock,
      config,
      onError,
    },
    { roomId, roundId: ROUND, playerId: me.uid, playEndsAt: PLAY_END }
  );
  const number = () => world.server.numberOf(roomId, ROUND);
  const points = () => world.server.readPoints(me.uid, roomId, ROUND)[me.uid];
  const pulses = () => world.server.pulsesOf(roomId, ROUND)[me.uid];
  return { ...world, me, roomId, batcher, onError, number, points, pulses };
}
