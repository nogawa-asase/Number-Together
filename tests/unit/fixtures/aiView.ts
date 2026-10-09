import type { AiParams } from '../../../src/domain/ai/aiParams';
import type { AiView } from '../../../src/domain/ai/aiView';
import { createRandom } from '../../../src/domain/ai/random';
import type { AiMove, PersonalityBrain } from '../../../src/domain/ai/types';

/** テスト用のAIが見る状態。目標1,000(範囲 900〜1,100)、ゲームの中盤、数字は950 */
export function viewOf(partial: Partial<AiView> = {}): AiView {
  return {
    number: 950,
    target: 1_000,
    lower: 900,
    upper: 1_100,
    remainingMs: 150_000,
    bonusActive: false,
    elapsedRatio: 0.5,
    ...partial,
  };
}

/** 種を固定した乱数で、同じ状態のまま ticks 回まわし、+1・−1の回数を数える(250ミリ秒ごと) */
export function tally(
  brain: PersonalityBrain,
  view: AiView,
  params: AiParams,
  ticks = 4_000,
  seed = 20_261_009
): { plus: number; minus: number; perSec: { plus: number; minus: number } } {
  const random = createRandom(seed);
  let plus = 0;
  let minus = 0;
  for (let i = 0; i < ticks; i++) {
    const move: AiMove = brain(view, 250, random, params);
    if (move === '+1') plus++;
    if (move === '-1') minus++;
  }
  const seconds = (ticks * 250) / 1_000;
  return {
    plus,
    minus,
    perSec: { plus: plus / seconds, minus: minus / seconds },
  };
}
