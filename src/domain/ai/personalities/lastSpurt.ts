import { pressChance } from '../pressChance';
import type { PersonalityBrain } from '../types';

/**
 * ラストスパート: 倍増タイムの前は、ほとんど押さない。倍増タイムが始まったら、一気に+1を押す。
 * 範囲を超えそうなとき(上端から holdBackMargin 以内)は、控える
 */
export const lastSpurt: PersonalityBrain = (view, dtMs, random, params) => {
  const p = params.lastSpurt;
  if (!view.bonusActive) {
    return random.next() < pressChance(p.idlePerSec, dtMs) ? '+1' : null;
  }
  if (view.number >= view.upper - p.holdBackMargin) {
    return null;
  }
  return random.next() < pressChance(p.spurtPerSec, dtMs) ? '+1' : null;
};
