import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS as PARAMS } from '../../../../src/domain/ai/aiParams';
import { tempoFor, withTempo } from '../../../../src/domain/ai/tempo';
import { DomainError } from '../../../../src/domain/errors';
import { fixedRandom } from '../../fixtures/random';

describe('tempoFor', () => {
  it('1 ± tempoSpread の間で選ぶ', () => {
    expect(tempoFor(fixedRandom(0), PARAMS)).toBeCloseTo(0.2);
    expect(tempoFor(fixedRandom(0.5), PARAMS)).toBe(1);
    expect(tempoFor(fixedRandom(0.999), PARAMS)).toBeCloseTo(1.7984);
  });

  it('tempoSpread が0なら、いつも1', () => {
    const params = { ...PARAMS, tempoSpread: 0 };
    expect(tempoFor(fixedRandom(0), params)).toBe(1);
  });
});

describe('withTempo', () => {
  it('押す頻度(1秒あたりの回数)だけを、tempo 倍する', () => {
    const p = withTempo(PARAMS, 2);
    expect(p.greedy).toEqual({
      ...PARAMS.greedy,
      plusPerSec: PARAMS.greedy.plusPerSec * 2,
      bonusPlusPerSec: PARAMS.greedy.bonusPlusPerSec * 2,
      minusPerSec: PARAMS.greedy.minusPerSec * 2,
    });
    expect(p.balancer).toEqual({
      correctPerSec: PARAMS.balancer.correctPerSec * 2,
      idlePerSec: PARAMS.balancer.idlePerSec * 2,
    });
    expect(p.perfectionist).toEqual({
      ...PARAMS.perfectionist,
      slowPerSec: PARAMS.perfectionist.slowPerSec * 2,
      finalPerSec: PARAMS.perfectionist.finalPerSec * 2,
    });
    expect(p.moody).toEqual({
      ...PARAMS.moody,
      pressPerSec: PARAMS.moody.pressPerSec * 2,
      burstPerSec: PARAMS.moody.burstPerSec * 2,
    });
    expect(p.lastSpurt).toEqual({
      ...PARAMS.lastSpurt,
      idlePerSec: PARAMS.lastSpurt.idlePerSec * 2,
      spurtPerSec: PARAMS.lastSpurt.spurtPerSec * 2,
    });
  });

  it('頻度でない値は変えない', () => {
    const p = withTempo(PARAMS, 0.5);
    expect(p.tickMs).toBe(PARAMS.tickMs);
    expect(p.reactionDelayMinMs).toBe(PARAMS.reactionDelayMinMs);
    expect(p.tempoSpread).toBe(PARAMS.tempoSpread);
    expect(p.greedy.nearUpperFactor).toBe(PARAMS.greedy.nearUpperFactor);
    expect(p.moody.burstChance).toBe(PARAMS.moody.burstChance);
    expect(p.lastSpurt.holdBackMargin).toBe(PARAMS.lastSpurt.holdBackMargin);
  });

  it('tempo が1なら、元と同じ値', () => {
    expect(withTempo(PARAMS, 1)).toEqual(PARAMS);
  });

  it.each([-0.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'tempo が不正(%s)なら DomainError',
    (tempo) => {
      expect(() => withTempo(PARAMS, tempo)).toThrow(DomainError);
    }
  );
});
