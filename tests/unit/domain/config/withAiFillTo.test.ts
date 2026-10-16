import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { withAiFillTo } from '../../../../src/domain/config/withAiFillTo';

describe('withAiFillTo', () => {
  it.each([undefined, ''])('値が %j なら、設定はそのまま', (value) => {
    expect(withAiFillTo(DEFAULT_CONFIG, value)).toBe(DEFAULT_CONFIG);
  });

  it('20なら、AIで20人まで埋める(ほかの値は変えない)', () => {
    expect(withAiFillTo(DEFAULT_CONFIG, '20')).toEqual({
      ...DEFAULT_CONFIG,
      aiFillTo: 20,
    });
  });

  it('0なら、AIを足さない', () => {
    expect(withAiFillTo(DEFAULT_CONFIG, '0')?.aiFillTo).toBe(0);
  });

  it.each(['21', '-1', '1.5', 'abc', ' 5'])(
    '%j は不正なので null(定員を超える・整数でない)',
    (value) => {
      expect(withAiFillTo(DEFAULT_CONFIG, value)).toBeNull();
    }
  );
});
