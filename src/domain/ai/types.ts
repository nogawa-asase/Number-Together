import type { AiParams } from './aiParams';
import type { AiView } from './aiView';
import type { Random } from './random';

/** AIの手。押すなら +1 か −1、何もしないなら null */
export type AiMove = '+1' | '-1' | null;

/** 性格ごとの、手の選び方 */
export type PersonalityBrain = (
  view: AiView,
  dtMs: number,
  random: Random,
  params: AiParams
) => AiMove;
