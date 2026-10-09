import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../src/domain/ai/aiParams';
import { decide } from '../../../../src/domain/ai/decide';
import { createRandom } from '../../../../src/domain/ai/random';
import type { AiPersonality } from '../../../../src/domain/types';
import { viewOf } from '../../fixtures/aiView';
import { fixedRandom } from '../../fixtures/random';

const ALL: AiPersonality[] = [
  'greedy',
  'balancer',
  'perfectionist',
  'moody',
  'lastSpurt',
];

describe('decide', () => {
  it('性格ごとの選び方に振り分ける(同じ状態・同じ乱数でも、性格で手が変わる)', () => {
    // 範囲の上の外(1,200)・倍増タイム・残り10秒。乱数は、どの判断でも「当たり」になる0.01
    const view = viewOf({
      number: 1_200,
      bonusActive: true,
      remainingMs: 10_000,
    });
    const moves = Object.fromEntries(
      ALL.map((personality) => [
        personality,
        decide(personality, view, 250, fixedRandom(0.01), PARAMS),
      ])
    );
    expect(moves).toEqual({
      greedy: '-1', // −1の確率(0.0125)に当たる
      balancer: '-1', // 範囲の外なので戻す
      perfectionist: '-1', // 目標より多いので減らす
      moody: '+1', // 連打の頻度で押し、向きは0.01 < 0.5 で+1
      lastSpurt: null, // 上端を超えているので控える
    });
  });

  it('種を固定すると、手の並びを再現できる', () => {
    const run = (seed: number) => {
      const random = createRandom(seed);
      return Array.from({ length: 200 }, (_, i) =>
        decide(ALL[i % ALL.length]!, viewOf(), 250, random, PARAMS)
      );
    };
    expect(run(99)).toEqual(run(99));
    expect(run(99)).not.toEqual(run(100));
  });

  it('tick の長さが0なら、どの性格も押さない', () => {
    for (const personality of ALL) {
      expect(
        decide(personality, viewOf(), 0, fixedRandom(0), PARAMS)
      ).toBeNull();
    }
  });
});
