import type { AiPersonality } from '../types';
import type { AiParams } from './aiParams';
import type { AiView } from './aiView';
import { balancer } from './personalities/balancer';
import { greedy } from './personalities/greedy';
import { lastSpurt } from './personalities/lastSpurt';
import { moody } from './personalities/moody';
import { perfectionist } from './personalities/perfectionist';
import type { Random } from './random';
import type { AiMove, PersonalityBrain } from './types';

const BRAINS: Readonly<Record<AiPersonality, PersonalityBrain>> = {
  greedy,
  balancer,
  perfectionist,
  moody,
  lastSpurt,
};

/**
 * AIの手を選ぶ(docs/functional-design.md「AiBrain」)。一定の間隔(tick)ごとに呼ぶ。
 *
 * AIどうしは結託しない。それぞれ、自分の性格と、見ている状態だけで選ぶ。
 * AIのポイントは、ここではなく、AiHost が pointsForPress で計算する。
 *
 * @param personality - AIの性格
 * @param view - AIが見る状態(aiViewAt の結果)
 * @param dtMs - 前の tick からの時間
 * @param random - 乱数
 * @param params - AIの設定値
 * @returns 押すなら +1 か −1、何もしないなら null
 */
export function decide(
  personality: AiPersonality,
  view: AiView,
  dtMs: number,
  random: Random,
  params: AiParams
): AiMove {
  return BRAINS[personality](view, dtMs, random, params);
}
