import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { isInRange, rangeFor } from '../../../../src/domain/targets/rangeFor';

/** 整数だけで計算した、±10% の範囲(浮動小数点を使わない、比べるための答え) */
function exactRange10(target: number) {
  const lowerNum = target * 9; // target × 0.9 × 10
  const upperNum = target * 11; // target × 1.1 × 10
  return {
    lower: (lowerNum + ((10 - (lowerNum % 10)) % 10)) / 10, // 切り上げ
    upper: (upperNum - (upperNum % 10)) / 10, // 切り下げ
  };
}

describe('rangeFor', () => {
  it('目標1,000の範囲は 900〜1,100', () => {
    expect(rangeFor(1_000, DEFAULT_CONFIG)).toEqual({
      lower: 900,
      upper: 1_100,
    });
  });

  it('目標2,400の範囲は 2,160〜2,640', () => {
    expect(rangeFor(2_400, DEFAULT_CONFIG)).toEqual({
      lower: 2_160,
      upper: 2_640,
    });
  });

  it('割り切れないとき、下端は切り上げ、上端は切り下げ(範囲の内側に寄せる)', () => {
    // 1,005 × 0.9 = 904.5、1,005 × 1.1 = 1,105.5
    expect(rangeFor(1_005, DEFAULT_CONFIG)).toEqual({
      lower: 905,
      upper: 1_105,
    });
  });

  it('浮動小数点の誤差で、端がずれない(目標 0〜100,000 のすべての整数)', () => {
    // 例: 200 × 1.1 は 220.00000000000003 になるが、上端は 220
    for (let target = 0; target <= 100_000; target++) {
      const actual = rangeFor(target, DEFAULT_CONFIG);
      const expected = exactRange10(target);
      if (actual.lower !== expected.lower || actual.upper !== expected.upper) {
        expect.fail(
          `目標 ${target}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`
        );
      }
    }
  });

  it('範囲の割合は、設定で変えられる', () => {
    const config = { ...DEFAULT_CONFIG, rangeRatio: 0.15 };
    expect(rangeFor(1_000, config)).toEqual({ lower: 850, upper: 1_150 });
  });

  it('割合を変えても、誤差で端がずれない', () => {
    // 100 × 1.15 は 114.99999999999999 になるが、上端は 115
    const config = { ...DEFAULT_CONFIG, rangeRatio: 0.15 };
    expect(rangeFor(100, config)).toEqual({ lower: 85, upper: 115 });
  });

  it.each([-1, 0.5, Number.NaN])('目標が %s なら DomainError', (target) => {
    expect(() => rangeFor(target, DEFAULT_CONFIG)).toThrow(DomainError);
  });
});

describe('isInRange', () => {
  it.each([
    [899, false],
    [900, true],
    [1_000, true],
    [1_100, true],
    [1_101, false],
  ])('目標1,000で、%i は範囲の中か: %s', (value, expected) => {
    expect(isInRange(value, 1_000, DEFAULT_CONFIG)).toBe(expected);
  });

  it('負の数は、範囲の外', () => {
    expect(isInRange(-1, 1_000, DEFAULT_CONFIG)).toBe(false);
  });
});
