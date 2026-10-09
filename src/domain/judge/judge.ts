import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';
import { rangeFor } from '../targets/rangeFor';
import type { Outcome } from '../types';

/** 結果の判定 */
export interface Verdict {
  readonly outcome: Outcome;
  /**
   * 失敗のとき、範囲に届かなかった量(正の数)。足りないときも、多すぎるときも、量だけを出す
   * (「あと120足りなかった」)。失敗でなければ null
   */
  readonly missBy: number | null;
}

/**
 * ゲーム終了時の数字と目標から、結果を判定する(docs/functional-design.md「4. 結果の判定と報酬」)。
 *
 * 目標ちょうどは、ぴったり成功。範囲の中(端を含む)は、成功。それ以外は、失敗。
 *
 * @param finalNumber - ゲーム終了時の共有の数字(整数。−1 を押し続けると負にもなる)
 * @param target - 終了時点の人数から求めた目標(0以上の整数)
 * @param config - 設定値(rangeRatio を使う)
 * @throws DomainError - finalNumber が整数でないとき、target が0以上の整数でないとき
 */
export function judge(
  finalNumber: number,
  target: number,
  config: GameConfig
): Verdict {
  if (!Number.isSafeInteger(finalNumber)) {
    throw new DomainError(`最終値が不正です: ${finalNumber}`);
  }
  const { lower, upper } = rangeFor(target, config);

  if (finalNumber === target) {
    return { outcome: 'perfect', missBy: null };
  }
  if (finalNumber < lower) {
    return { outcome: 'fail', missBy: lower - finalNumber };
  }
  if (finalNumber > upper) {
    return { outcome: 'fail', missBy: finalNumber - upper };
  }
  return { outcome: 'success', missBy: null };
}
