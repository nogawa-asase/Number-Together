import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../../src/domain/ai/aiParams';
import { perfectionist } from '../../../../../src/domain/ai/personalities/perfectionist';
import { tally, viewOf } from '../../../fixtures/aiView';
import { fixedRandom } from '../../../fixtures/random';

describe('perfectionist(ぴったり主義)', () => {
  describe('分岐', () => {
    it('前半は、目標の方へ、ゆっくり押す(確率0.125)', () => {
      const view = viewOf({ number: 950 });
      expect(perfectionist(view, 250, fixedRandom(0.12), PARAMS)).toBe('+1');
      expect(perfectionist(view, 250, fixedRandom(0.13), PARAMS)).toBeNull();
    });

    it('残り20秒ちょうどから、速く合わせにいく(確率1)', () => {
      const view = viewOf({ number: 1_010, remainingMs: 20_000 });
      expect(perfectionist(view, 250, fixedRandom(0.99), PARAMS)).toBe('-1');
    });

    it('残り20秒より1ミリ秒多ければ、まだゆっくり', () => {
      const view = viewOf({ number: 1_010, remainingMs: 20_001 });
      expect(perfectionist(view, 250, fixedRandom(0.99), PARAMS)).toBeNull();
    });

    it('ぴったりなら、押さない', () => {
      const view = viewOf({ number: 1_000, remainingMs: 5_000 });
      expect(perfectionist(view, 250, fixedRandom(0), PARAMS)).toBeNull();
    });
  });

  it('傾向: 終盤は、目標より少なければ+1だけを、1秒に約4回押す', () => {
    const { perSec, minus } = tally(
      perfectionist,
      viewOf({ number: 990, remainingMs: 10_000 }),
      PARAMS
    );
    expect(perSec.plus).toBeGreaterThan(3.9);
    expect(minus).toBe(0);
  });
});
