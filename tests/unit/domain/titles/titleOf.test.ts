import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { titleOf } from '../../../../src/domain/titles/titleOf';
import { statsOf } from '../../fixtures/stats';

describe('titleOf', () => {
  it('はじめての人は、新人', () => {
    expect(titleOf(statsOf(), DEFAULT_CONFIG)).toBe('rookie');
  });

  it.each([
    [{ plays: 19 }, 'rookie'],
    [{ plays: 20 }, 'regular'],
    [{ totalPoints: 1_999 }, 'rookie'],
    [{ totalPoints: 2_000 }, 'hoarder'],
    [{ perfects: 4 }, 'rookie'],
    [{ perfects: 5 }, 'perfectKing'],
  ] as const)('実績 %o なら %s', (partial, expected) => {
    expect(titleOf(statsOf(partial), DEFAULT_CONFIG)).toBe(expected);
  });

  it('いくつも条件に合うときは、上の条件(ぴったり王 > 欲張り > 常連)を採用する', () => {
    const veteran = statsOf({ plays: 100, totalPoints: 9_999, perfects: 5 });
    expect(titleOf(veteran, DEFAULT_CONFIG)).toBe('perfectKing');

    const hoarderAndRegular = statsOf({ plays: 100, totalPoints: 9_999 });
    expect(titleOf(hoarderAndRegular, DEFAULT_CONFIG)).toBe('hoarder');
  });

  it('条件は、設定で変えられる', () => {
    const config = {
      ...DEFAULT_CONFIG,
      titleRules: [{ id: 'regular', when: () => true }] as const,
    };
    expect(titleOf(statsOf(), config)).toBe('regular');
  });

  it('どの条件にも合わなければ、新人', () => {
    const config = {
      ...DEFAULT_CONFIG,
      titleRules: [{ id: 'perfectKing', when: () => false }] as const,
    };
    expect(titleOf(statsOf(), config)).toBe('rookie');
  });
});
