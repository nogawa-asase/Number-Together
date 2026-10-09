import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';

/** 目標の範囲。下端と上端を含む */
export interface Range {
  readonly lower: number;
  readonly upper: number;
}

/**
 * 掛け算の結果から、浮動小数点の誤差を取り除く。
 *
 * 例えば 200 × 1.1 は 220.00000000000003 になる。ceil に、ほんの少し大きい値が渡ると、
 * 端が1ずれるので、小数点以下9桁で丸めてから、ceil・floor する。
 */
function snap(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * 目標から、成功になる範囲(目標の±rangeRatio)を求める。
 *
 * 範囲の端は、内側に向けて整数にする(lower は切り上げ、upper は切り下げ)
 * (docs/development-guidelines.md「数値と時間」)。
 *
 * @param target - 目標(0以上の整数)
 * @param config - 設定値(rangeRatio を使う)
 * @throws DomainError - target が0以上の整数でないとき
 */
export function rangeFor(target: number, config: GameConfig): Range {
  if (!Number.isSafeInteger(target) || target < 0) {
    throw new DomainError(`目標が不正です: ${target}`);
  }
  return {
    lower: Math.ceil(snap(target * (1 - config.rangeRatio))),
    upper: Math.floor(snap(target * (1 + config.rangeRatio))),
  };
}

/**
 * 数字が、目標の範囲の中か(端を含む)。
 *
 * @param value - 調べる数字(整数)
 * @param target - 目標(0以上の整数)
 * @param config - 設定値(rangeRatio を使う)
 */
export function isInRange(
  value: number,
  target: number,
  config: GameConfig
): boolean {
  const { lower, upper } = rangeFor(target, config);
  return lower <= value && value <= upper;
}
