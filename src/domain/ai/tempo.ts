import { DomainError } from '../errors';
import type { AiParams } from './aiParams';
import type { Random } from './random';

/**
 * AIの「勢い」を選ぶ。AIごとに1回選び、押す頻度の倍率にする(同じ性格でも、個体差を出す)。
 *
 * 勢いがないと、同じ顔ぶれの回は、毎回ほぼ同じ数字で終わる(シミュレーションで確かめた)。
 *
 * @param random - 乱数
 * @param params - AIの設定値(tempoSpread を使う)
 * @returns 1 − tempoSpread 以上、1 + tempoSpread 未満
 */
export function tempoFor(random: Random, params: AiParams): number {
  return 1 + params.tempoSpread * (2 * random.next() - 1);
}

/**
 * 押す頻度(1秒あたりの回数)を、すべて tempo 倍した設定値を作る。
 * 頻度でない値(反応の遅れ、上端からの量、倍率、残り時間、確率)は変えない。
 *
 * @param params - AIの設定値
 * @param tempo - 倍率(0以上)
 * @throws DomainError - tempo が0以上の有限の数でないとき
 */
export function withTempo(params: AiParams, tempo: number): AiParams {
  if (!Number.isFinite(tempo) || tempo < 0) {
    throw new DomainError(`勢いが不正です: ${tempo}`);
  }
  const { greedy, balancer, perfectionist, moody, lastSpurt } = params;
  return {
    ...params,
    greedy: {
      ...greedy,
      plusPerSec: greedy.plusPerSec * tempo,
      bonusPlusPerSec: greedy.bonusPlusPerSec * tempo,
      minusPerSec: greedy.minusPerSec * tempo,
    },
    balancer: {
      correctPerSec: balancer.correctPerSec * tempo,
      idlePerSec: balancer.idlePerSec * tempo,
    },
    perfectionist: {
      ...perfectionist,
      slowPerSec: perfectionist.slowPerSec * tempo,
      finalPerSec: perfectionist.finalPerSec * tempo,
    },
    moody: {
      ...moody,
      pressPerSec: moody.pressPerSec * tempo,
      burstPerSec: moody.burstPerSec * tempo,
    },
    lastSpurt: {
      ...lastSpurt,
      idlePerSec: lastSpurt.idlePerSec * tempo,
      spurtPerSec: lastSpurt.spurtPerSec * tempo,
    },
  };
}
