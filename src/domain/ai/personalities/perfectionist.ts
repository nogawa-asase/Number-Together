import { pressChance } from '../pressChance';
import { towardTarget } from '../towardTarget';
import type { PersonalityBrain } from '../types';

/**
 * ぴったり主義: 前半は、目標に向けて、ゆっくり押す。残り finalWindowMs(20秒)を切ったら、
 * 目標との差を見て、足りなければ+1、多ければ−1を、速く押す。ぴったりなら押さない
 */
export const perfectionist: PersonalityBrain = (view, dtMs, random, params) => {
  const p = params.perfectionist;
  const direction = towardTarget(view);
  if (direction === null) {
    return null;
  }
  const perSec =
    view.remainingMs <= p.finalWindowMs ? p.finalPerSec : p.slowPerSec;
  return random.next() < pressChance(perSec, dtMs) ? direction : null;
};
