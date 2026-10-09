import { pressChance } from '../pressChance';
import type { PersonalityBrain } from '../types';

/**
 * がめつい: +1をよく押す。倍増タイム中はもっと多く。
 * 範囲の上端に近づいても、頻度が少し下がる程度で、止まらない。−1は、ほとんど押さない
 */
export const greedy: PersonalityBrain = (view, dtMs, random, params) => {
  const p = params.greedy;
  if (random.next() < pressChance(p.minusPerSec, dtMs)) {
    return '-1';
  }
  const basePerSec = view.bonusActive ? p.bonusPlusPerSec : p.plusPerSec;
  const perSec =
    view.number >= view.upper - p.nearUpperMargin
      ? basePerSec * p.nearUpperFactor
      : basePerSec;
  return random.next() < pressChance(perSec, dtMs) ? '+1' : null;
};
