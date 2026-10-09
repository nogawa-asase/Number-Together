import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';

/**
 * 集合中に、画面に出す人数を求める。
 *
 * 人間が aiFillTo 人に足りないときは、ゲーム開始時にAIが加わる前提で、aiFillTo 人として見せる
 * (docs/functional-design.md「2. 目標と範囲」)。
 *
 * @param humansInLobby - 集合中の人間の人数(0以上の整数)
 * @param config - 設定値(aiFillTo を使う)
 * @returns max(humansInLobby, aiFillTo)
 * @throws DomainError - humansInLobby が0以上の整数でないとき
 */
export function displayPlayerCount(
  humansInLobby: number,
  config: GameConfig
): number {
  if (!Number.isSafeInteger(humansInLobby) || humansInLobby < 0) {
    throw new DomainError(`人数が不正です: ${humansInLobby}`);
  }
  return Math.max(humansInLobby, config.aiFillTo);
}
