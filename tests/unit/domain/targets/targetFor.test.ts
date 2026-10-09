import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { targetFor } from '../../../../src/domain/targets/targetFor';

describe('targetFor', () => {
  it.each([
    [5, 1_000],
    [12, 2_400],
    [20, 4_000],
  ])('%i人の目標は %i', (playerCount, expected) => {
    expect(targetFor(playerCount, DEFAULT_CONFIG)).toBe(expected);
  });

  it('0人の目標は0(例外にしない)', () => {
    expect(targetFor(0, DEFAULT_CONFIG)).toBe(0);
  });

  it('途中参加で1人増えると、目標が200増える', () => {
    expect(targetFor(6, DEFAULT_CONFIG) - targetFor(5, DEFAULT_CONFIG)).toBe(
      200
    );
  });

  it('1人あたりの目標は、設定で変えられる', () => {
    const config = { ...DEFAULT_CONFIG, perPlayerTarget: 150 };
    expect(targetFor(5, config)).toBe(750);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '人数が %s なら DomainError',
    (playerCount) => {
      expect(() => targetFor(playerCount, DEFAULT_CONFIG)).toThrow(DomainError);
    }
  );
});
