import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../../src/domain/ai/aiParams';
import { balancer } from '../../../../../src/domain/ai/personalities/balancer';
import { tally, viewOf } from '../../../fixtures/aiView';
import { fixedRandom } from '../../../fixtures/random';

describe('balancer(調整役)', () => {
  describe('分岐', () => {
    it('下端より下なら、+1で戻す(確率0.375)', () => {
      const view = viewOf({ number: 899 });
      expect(balancer(view, 250, fixedRandom(0.374), PARAMS)).toBe('+1');
      expect(balancer(view, 250, fixedRandom(0.375), PARAMS)).toBeNull();
    });

    it('上端より上なら、−1で戻す', () => {
      const view = viewOf({ number: 1_101 });
      expect(balancer(view, 250, fixedRandom(0), PARAMS)).toBe('-1');
    });

    it('範囲の端ちょうどは、範囲の中(戻さず、たまに目標の方へ)', () => {
      const atLower = viewOf({ number: 900 });
      expect(balancer(atLower, 250, fixedRandom(0.5), PARAMS)).toBeNull();
      expect(balancer(atLower, 250, fixedRandom(0.07), PARAMS)).toBe('+1');
      const atUpper = viewOf({ number: 1_100 });
      expect(balancer(atUpper, 250, fixedRandom(0.07), PARAMS)).toBe('-1');
    });

    it('目標ちょうどなら、押さない', () => {
      const view = viewOf({ number: 1_000 });
      expect(balancer(view, 250, fixedRandom(0), PARAMS)).toBeNull();
    });
  });

  describe('傾向', () => {
    it('範囲の外では、1秒に約1.5回、戻す方向だけに押す', () => {
      const low = tally(balancer, viewOf({ number: 500 }), PARAMS);
      expect(low.perSec.plus).toBeGreaterThan(1.3);
      expect(low.perSec.plus).toBeLessThan(1.7);
      expect(low.minus).toBe(0);
      const high = tally(balancer, viewOf({ number: 1_500 }), PARAMS);
      expect(high.perSec.minus).toBeGreaterThan(1.3);
      expect(high.perSec.minus).toBeLessThan(1.7);
      expect(high.plus).toBe(0);
    });

    it('範囲の中では、1秒に約0.3回しか押さない', () => {
      const { perSec } = tally(balancer, viewOf({ number: 950 }), PARAMS);
      expect(perSec.plus).toBeGreaterThan(0.2);
      expect(perSec.plus).toBeLessThan(0.4);
    });
  });
});
