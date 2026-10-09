import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../../src/domain/ai/aiParams';
import { moody } from '../../../../../src/domain/ai/personalities/moody';
import { tally, viewOf } from '../../../fixtures/aiView';
import { fixedRandom } from '../../../fixtures/random';

describe('moody(気まぐれ)', () => {
  describe('分岐', () => {
    it('ふだんは、確率0.25で押す。向きは半々', () => {
      // 1つ目: 連打にならない(0.5 ≥ 0.1)、2つ目: 押す(0.2 < 0.25)、3つ目: 向き
      expect(moody(viewOf(), 250, fixedRandom(0.5, 0.2, 0.4), PARAMS)).toBe(
        '+1'
      );
      expect(moody(viewOf(), 250, fixedRandom(0.5, 0.2, 0.6), PARAMS)).toBe(
        '-1'
      );
      expect(moody(viewOf(), 250, fixedRandom(0.5, 0.25), PARAMS)).toBeNull();
    });

    it('連打のときは、確率1で押す', () => {
      expect(moody(viewOf(), 250, fixedRandom(0.05, 0.99, 0.1), PARAMS)).toBe(
        '+1'
      );
    });
  });

  it('傾向: +1と−1の両方を、同じくらい押す', () => {
    const { plus, minus } = tally(moody, viewOf(), PARAMS);
    expect(plus).toBeGreaterThan(300);
    expect(minus).toBeGreaterThan(300);
    expect(Math.abs(plus - minus)).toBeLessThan((plus + minus) * 0.2);
  });
});
