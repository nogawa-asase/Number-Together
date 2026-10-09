import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';

/** 合図の強さ。0は押していない。小人の跳ねる高さと速さに使う */
export type PulsePower = 0 | 1 | 2 | 3;

/**
 * 直近 pulseIntervalMs(1秒)に押した回数(+1と−1の合計)から、合図の強さを求める
 * (docs/functional-design.md「エンティティ: Round」)。
 *
 * pulsePowerSteps = [1, 3, 6] のとき: 0回→0、1〜2回→1、3〜5回→2、6回以上→3
 *
 * @param pressCount - 直近に押した回数(0以上の整数)
 * @param config - 設定値(pulsePowerSteps を使う)
 * @throws DomainError - pressCount が0以上の整数でないとき
 */
export function pulsePowerFor(
  pressCount: number,
  config: GameConfig
): PulsePower {
  if (!Number.isSafeInteger(pressCount) || pressCount < 0) {
    throw new DomainError(`押した回数が不正です: ${pressCount}`);
  }
  const [toOne, toTwo, toThree] = config.pulsePowerSteps;
  if (pressCount >= toThree) return 3;
  if (pressCount >= toTwo) return 2;
  if (pressCount >= toOne) return 1;
  return 0;
}
