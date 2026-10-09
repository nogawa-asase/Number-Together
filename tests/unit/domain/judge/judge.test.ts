import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { judge } from '../../../../src/domain/judge/judge';

// 目標1,000、範囲 900〜1,100(5人)
const TARGET = 1_000;

describe('judge', () => {
  it('目標ちょうどは、ぴったり成功', () => {
    expect(judge(1_000, TARGET, DEFAULT_CONFIG)).toEqual({
      outcome: 'perfect',
      missBy: null,
    });
  });

  it.each([900, 999, 1_001, 1_100])('範囲の中(%i)は、成功', (final) => {
    expect(judge(final, TARGET, DEFAULT_CONFIG)).toEqual({
      outcome: 'success',
      missBy: null,
    });
  });

  it('下端の1つ下は、失敗。あと1足りない', () => {
    expect(judge(899, TARGET, DEFAULT_CONFIG)).toEqual({
      outcome: 'fail',
      missBy: 1,
    });
  });

  it('上端の1つ上は、失敗。1多すぎる', () => {
    expect(judge(1_101, TARGET, DEFAULT_CONFIG)).toEqual({
      outcome: 'fail',
      missBy: 1,
    });
  });

  it('足りないときの量は、目標ではなく、下端からの量', () => {
    // 780 → 下端900まで、あと120
    expect(judge(780, TARGET, DEFAULT_CONFIG).missBy).toBe(120);
  });

  it('多すぎるときの量は、上端からの量', () => {
    expect(judge(1_250, TARGET, DEFAULT_CONFIG).missBy).toBe(150);
  });

  it('最終値が負でも、判定できる', () => {
    expect(judge(-5, TARGET, DEFAULT_CONFIG)).toEqual({
      outcome: 'fail',
      missBy: 905,
    });
  });

  it('目標0で最終値0は、ぴったり成功', () => {
    expect(judge(0, 0, DEFAULT_CONFIG).outcome).toBe('perfect');
  });

  it('範囲の端が割り切れないときも、内側に寄せた端で判定する', () => {
    // 目標1,005: 範囲 905〜1,105
    expect(judge(904, 1_005, DEFAULT_CONFIG).outcome).toBe('fail');
    expect(judge(905, 1_005, DEFAULT_CONFIG).outcome).toBe('success');
    expect(judge(1_105, 1_005, DEFAULT_CONFIG).outcome).toBe('success');
    expect(judge(1_106, 1_005, DEFAULT_CONFIG).outcome).toBe('fail');
  });

  it.each([1.5, Number.NaN])('最終値が %s なら DomainError', (final) => {
    expect(() => judge(final, TARGET, DEFAULT_CONFIG)).toThrow(DomainError);
  });

  it('目標が不正なら DomainError', () => {
    expect(() => judge(0, -1, DEFAULT_CONFIG)).toThrow(DomainError);
  });
});
