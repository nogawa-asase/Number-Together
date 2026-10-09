import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';
import type { Outcome } from '../types';
import type { Settlement } from './types';

/**
 * 結果が出たときの、報酬と実績の変化を求める(docs/functional-design.md「4. 結果の判定と報酬」)。
 *
 * | 結果     | 報酬                              | 実績の変化                         |
 * | ぴったり | 貯めたポイント × perfectMultiplier | plays・successes・perfects を +1   |
 * | 成功     | 貯めたポイント                     | plays・successes を +1             |
 * | 失敗     | 0                                 | plays を +1                        |
 *
 * どの結果でも、報酬を totalPoints に足す。倍率が小数でも、報酬は整数(切り捨て)。
 * 同じ回を二重に数えない判断(lastCountedRound)は、呼ぶ側が行う。
 *
 * @param outcome - judge の結果
 * @param points - この回で貯めたポイント(0以上の整数)
 * @param config - 設定値(perfectMultiplier を使う)
 * @throws DomainError - points が0以上の整数でないとき
 */
export function settle(
  outcome: Outcome,
  points: number,
  config: GameConfig
): Settlement {
  if (!Number.isSafeInteger(points) || points < 0) {
    throw new DomainError(`貯めたポイントが不正です: ${points}`);
  }

  switch (outcome) {
    case 'perfect': {
      const awarded = Math.floor(points * config.perfectMultiplier);
      return {
        awarded,
        statsDelta: {
          plays: 1,
          successes: 1,
          perfects: 1,
          totalPoints: awarded,
        },
      };
    }
    case 'success':
      return {
        awarded: points,
        statsDelta: {
          plays: 1,
          successes: 1,
          perfects: 0,
          totalPoints: points,
        },
      };
    case 'fail':
      return {
        awarded: 0,
        statsDelta: { plays: 1, successes: 0, perfects: 0, totalPoints: 0 },
      };
  }
}
