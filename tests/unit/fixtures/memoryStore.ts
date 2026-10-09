import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import type { GameConfig } from '../../../src/domain/config/types';
import { FakeClock } from '../../../src/infra/memory/FakeClock';
import { InMemoryGameStore } from '../../../src/infra/memory/InMemoryGameStore';
import { InMemoryServer } from '../../../src/infra/memory/InMemoryServer';

/** ある回(第4928211回)の各時刻 */
export const ROUND = '4928211';
export const START = 4_928_211 * 360_000; // 集合の始まり
export const PLAY_START = START + 30_000;
export const PLAY_END = START + 330_000;
export const GRACE_END = PLAY_END + 3_000; // ポイントの猶予の終わり
export const NEXT_START = START + 360_000;

/** メモリ上のサーバーと時計を作り、利用者をつなぐ補助 */
export function memoryWorld(
  startMs = PLAY_START,
  config: GameConfig = DEFAULT_CONFIG
) {
  const clock = new FakeClock(startMs);
  const server = new InMemoryServer(clock, config);

  /** 新しい利用者をつなぎ、サインインする */
  async function connect() {
    const store = new InMemoryGameStore(server);
    const { uid } = await store.signIn();
    return { store, uid };
  }

  return { clock, server, connect };
}
