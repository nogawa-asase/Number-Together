import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';
import { isInRange } from '../targets/rangeFor';
import type { PressInput } from './types';

/**
 * +1・−1を押した瞬間に、貯まるポイントを求める(docs/functional-design.md「3. ポイントの計算」)。
 *
 * - +1は1ポイント。倍増タイム中で、押した瞬間の数字が範囲の中なら、bonusMultiplier(3)ポイント
 * - −1は0ポイント
 * - ゲーム中でなければ0(終了後の加算は、サーバーでも受け付けないため)
 * - pointCap があれば、貯めたポイントが上限を超えない量にする
 *
 * @param input - 押した操作と、その瞬間の状態
 * @param config - 設定値(rangeRatio・bonusMultiplier・pointCap を使う)
 * @returns 貯まるポイント(0以上の整数)
 * @throws DomainError - numberAtPress が整数でないとき、currentPoints が0以上の整数でないとき
 */
export function pointsForPress(input: PressInput, config: GameConfig): number {
  const { kind, numberAtPress, target, nowMs, clock, currentPoints } = input;
  if (!Number.isSafeInteger(numberAtPress)) {
    throw new DomainError(`押した瞬間の数字が不正です: ${numberAtPress}`);
  }
  if (!Number.isSafeInteger(currentPoints) || currentPoints < 0) {
    throw new DomainError(`貯めたポイントが不正です: ${currentPoints}`);
  }

  if (kind === '-1') {
    return 0;
  }
  if (nowMs < clock.playStartsAt || nowMs >= clock.playEndsAt) {
    return 0;
  }

  const bonus =
    nowMs >= clock.bonusStartsAt && isInRange(numberAtPress, target, config);
  const gain = bonus ? config.bonusMultiplier : 1;

  if (config.pointCap === null) {
    return gain;
  }
  return Math.min(gain, Math.max(0, config.pointCap - currentPoints));
}
