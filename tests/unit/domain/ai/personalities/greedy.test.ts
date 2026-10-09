import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../../src/domain/ai/aiParams';
import { greedy } from '../../../../../src/domain/ai/personalities/greedy';
import { tally, viewOf } from '../../../fixtures/aiView';
import { fixedRandom } from '../../../fixtures/random';

describe('greedy(がめつい)', () => {
  describe('分岐', () => {
    it('−1の確率に当たれば、−1', () => {
      // −1の確率は 0.05 × 0.25 = 0.0125
      expect(greedy(viewOf(), 250, fixedRandom(0.01), PARAMS)).toBe('-1');
    });

    it('ふだんは、確率0.5で+1(1秒に2回、tick 250ミリ秒)', () => {
      expect(greedy(viewOf(), 250, fixedRandom(0.5, 0.49), PARAMS)).toBe('+1');
      expect(greedy(viewOf(), 250, fixedRandom(0.5, 0.5), PARAMS)).toBeNull();
    });

    it('倍増タイム中は、確率1で+1(1秒に4回)', () => {
      const view = viewOf({ bonusActive: true });
      expect(greedy(view, 250, fixedRandom(0.5, 0.99), PARAMS)).toBe('+1');
    });

    it('上端の50以内では、頻度が0.7倍(確率0.35)', () => {
      const view = viewOf({ number: 1_050 });
      expect(greedy(view, 250, fixedRandom(0.5, 0.34), PARAMS)).toBe('+1');
      expect(greedy(view, 250, fixedRandom(0.5, 0.36), PARAMS)).toBeNull();
    });

    it('上端の51手前では、頻度は下がらない', () => {
      const view = viewOf({ number: 1_049 });
      expect(greedy(view, 250, fixedRandom(0.5, 0.49), PARAMS)).toBe('+1');
    });
  });

  describe('傾向(種を固定して1,000秒)', () => {
    it('+1を1秒に約2回押し、−1はほとんど押さない', () => {
      const { perSec } = tally(greedy, viewOf(), PARAMS);
      expect(perSec.plus).toBeGreaterThan(1.7);
      expect(perSec.plus).toBeLessThan(2.1);
      expect(perSec.minus).toBeLessThan(0.1);
    });

    it('範囲を超えていても、止まらない', () => {
      const { perSec } = tally(greedy, viewOf({ number: 1_300 }), PARAMS);
      expect(perSec.plus).toBeGreaterThan(1);
    });

    it('倍増タイム中は、もっと押す', () => {
      const normal = tally(greedy, viewOf(), PARAMS);
      const bonus = tally(greedy, viewOf({ bonusActive: true }), PARAMS);
      expect(bonus.plus).toBeGreaterThan(normal.plus);
    });
  });
});
