import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { displayPlayerCount } from '../../../../src/domain/targets/displayPlayerCount';

describe('displayPlayerCount', () => {
  it.each([
    [0, 5],
    [2, 5],
    [4, 5],
    [5, 5],
    [12, 12],
  ])('集合中の人間が %i人なら、%i人として見せる', (humans, expected) => {
    expect(displayPlayerCount(humans, DEFAULT_CONFIG)).toBe(expected);
  });

  it('AIで補う人数は、設定で変えられる', () => {
    const config = { ...DEFAULT_CONFIG, aiFillTo: 3 };
    expect(displayPlayerCount(2, config)).toBe(3);
  });

  it.each([-1, 2.5])('人数が %s なら DomainError', (humans) => {
    expect(() => displayPlayerCount(humans, DEFAULT_CONFIG)).toThrow(
      DomainError
    );
  });
});
