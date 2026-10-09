import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../../src/domain/ai/aiParams';
import { lastSpurt } from '../../../../../src/domain/ai/personalities/lastSpurt';
import { tally, viewOf } from '../../../fixtures/aiView';
import { fixedRandom } from '../../../fixtures/random';

describe('lastSpurt(ラストスパート)', () => {
  describe('分岐', () => {
    it('倍増タイムの前は、ほとんど押さない(確率0.025)', () => {
      expect(lastSpurt(viewOf(), 250, fixedRandom(0.02), PARAMS)).toBe('+1');
      expect(lastSpurt(viewOf(), 250, fixedRandom(0.03), PARAMS)).toBeNull();
    });

    it('倍増タイム中は、確率1で+1', () => {
      const view = viewOf({ bonusActive: true });
      expect(lastSpurt(view, 250, fixedRandom(0.99), PARAMS)).toBe('+1');
    });

    it('倍増タイム中の頻度は、設定で変えられる(1秒に2回なら、確率0.5)', () => {
      const params = {
        ...PARAMS,
        lastSpurt: { ...PARAMS.lastSpurt, spurtPerSec: 2 },
      };
      const view = viewOf({ bonusActive: true });
      expect(lastSpurt(view, 250, fixedRandom(0.49), params)).toBe('+1');
      expect(lastSpurt(view, 250, fixedRandom(0.5), params)).toBeNull();
    });

    it('上端の20以内では、控える', () => {
      const view = viewOf({ bonusActive: true, number: 1_080 });
      expect(lastSpurt(view, 250, fixedRandom(0), PARAMS)).toBeNull();
    });

    it('上端の21手前なら、まだ押す', () => {
      const view = viewOf({ bonusActive: true, number: 1_079 });
      expect(lastSpurt(view, 250, fixedRandom(0), PARAMS)).toBe('+1');
    });
  });

  it('傾向: 倍増タイムの前は1秒に約0.1回、倍増タイムで一気に増える', () => {
    const before = tally(lastSpurt, viewOf(), PARAMS);
    expect(before.perSec.plus).toBeLessThan(0.2);
    const during = tally(lastSpurt, viewOf({ bonusActive: true }), PARAMS);
    expect(during.perSec.plus).toBeGreaterThan(3.9);
    expect(before.minus + during.minus).toBe(0);
  });
});
