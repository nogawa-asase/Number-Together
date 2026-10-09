import { DomainError } from '../errors';
import type { AiPersonality } from '../types';
import type { Random } from './random';

/** AIの性格の一覧(docs/glossary.md「AIの性格」の順) */
export const AI_PERSONALITIES: readonly AiPersonality[] = [
  'greedy',
  'balancer',
  'perfectionist',
  'moody',
  'lastSpurt',
];

/** 一覧を、乱数で混ぜた新しい配列にする(Fisher–Yates) */
function shuffled(random: Random): AiPersonality[] {
  const result = [...AI_PERSONALITIES];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * AIを足すときの性格を選ぶ(docs/functional-design.md「ゲーム開始時のAIの追加」)。
 *
 * 5種類の中から、重ならないように選ぶ。足りなければ、5種類を一巡してから、重ねて選ぶ。
 *
 * @param count - 足すAIの数(0以上の整数)
 * @param random - 乱数
 * @throws DomainError - count が0以上の整数でないとき
 */
export function pickPersonalities(
  count: number,
  random: Random
): AiPersonality[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new DomainError(`AIの数が不正です: ${count}`);
  }
  const picked: AiPersonality[] = [];
  while (picked.length < count) {
    picked.push(...shuffled(random).slice(0, count - picked.length));
  }
  return picked;
}
