import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';

/**
 * 回の参加者の人数から、目標を求める(docs/functional-design.md「2. 目標と範囲」)。
 *
 * 参加者の一覧(players)は、追加するだけで減らないので、人が抜けても目標は下がらない。
 *
 * @param playerCount - 回の参加者の人数(人間 + AI。0以上の整数)
 * @param config - 設定値(perPlayerTarget を使う)
 * @returns playerCount × perPlayerTarget
 * @throws DomainError - playerCount が0以上の整数でないとき
 */
export function targetFor(playerCount: number, config: GameConfig): number {
  if (!Number.isSafeInteger(playerCount) || playerCount < 0) {
    throw new DomainError(`人数が不正です: ${playerCount}`);
  }
  return playerCount * config.perPlayerTarget;
}
