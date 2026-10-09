import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { pulsePowerFor } from '../../../../src/domain/pulses/pulsePowerFor';

describe('pulsePowerFor', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [40, 3],
  ])('既定の段階 [1, 3, 6] で、%i回押したら強さ %i', (count, expected) => {
    expect(pulsePowerFor(count, DEFAULT_CONFIG)).toBe(expected);
  });

  it('段階は、設定で変えられる', () => {
    const config = {
      ...DEFAULT_CONFIG,
      pulsePowerSteps: [2, 4, 8] as const,
    };
    expect(pulsePowerFor(1, config)).toBe(0);
    expect(pulsePowerFor(2, config)).toBe(1);
    expect(pulsePowerFor(4, config)).toBe(2);
    expect(pulsePowerFor(8, config)).toBe(3);
  });

  it.each([-1, 1.5, Number.NaN])('回数が %s なら DomainError', (count) => {
    expect(() => pulsePowerFor(count, DEFAULT_CONFIG)).toThrow(DomainError);
  });
});
