import { isWithinRange } from '../../targets/rangeFor';
import { pressChance } from '../pressChance';
import { towardTarget } from '../towardTarget';
import type { PersonalityBrain } from '../types';

/**
 * 調整役: 数字が範囲の外に出たら、戻す方向に押す。範囲の中では、たまに目標の方へ押す
 */
export const balancer: PersonalityBrain = (view, dtMs, random, params) => {
  const p = params.balancer;
  if (!isWithinRange(view.number, view)) {
    const back = view.number < view.lower ? '+1' : '-1';
    return random.next() < pressChance(p.correctPerSec, dtMs) ? back : null;
  }
  const direction = towardTarget(view);
  if (direction === null) {
    return null;
  }
  return random.next() < pressChance(p.idlePerSec, dtMs) ? direction : null;
};
