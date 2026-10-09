import { pressChance } from '../pressChance';
import type { PersonalityBrain } from '../types';

/**
 * 気まぐれ: 何もしない・+1・−1を、乱数で選ぶ。たまに連打する。
 *
 * decide は状態を持たないので、「毎秒選ぶ」を、tick ごとの乱数で近似する。
 * burstChance の確率で連打の頻度、それ以外はふだんの頻度。押す向きは半々
 */
export const moody: PersonalityBrain = (_view, dtMs, random, params) => {
  const p = params.moody;
  const perSec = random.next() < p.burstChance ? p.burstPerSec : p.pressPerSec;
  if (random.next() >= pressChance(perSec, dtMs)) {
    return null;
  }
  return random.next() < 0.5 ? '+1' : '-1';
};
