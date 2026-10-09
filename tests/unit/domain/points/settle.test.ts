import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { settle } from '../../../../src/domain/points/settle';

describe('settle', () => {
  it('ぴったり成功は、貯めたポイントの2倍。成功とぴったりを数える', () => {
    expect(settle('perfect', 120, DEFAULT_CONFIG)).toEqual({
      awarded: 240,
      statsDelta: { plays: 1, successes: 1, perfects: 1, totalPoints: 240 },
    });
  });

  it('成功は、貯めたポイントそのまま', () => {
    expect(settle('success', 120, DEFAULT_CONFIG)).toEqual({
      awarded: 120,
      statsDelta: { plays: 1, successes: 1, perfects: 0, totalPoints: 120 },
    });
  });

  it('失敗は、報酬0。参加回数だけを数える', () => {
    expect(settle('fail', 120, DEFAULT_CONFIG)).toEqual({
      awarded: 0,
      statsDelta: { plays: 1, successes: 0, perfects: 0, totalPoints: 0 },
    });
  });

  it('ポイントが0でも、参加回数は数える(押さずに見ていた人)', () => {
    expect(settle('perfect', 0, DEFAULT_CONFIG)).toEqual({
      awarded: 0,
      statsDelta: { plays: 1, successes: 1, perfects: 1, totalPoints: 0 },
    });
  });

  it('ぴったりの倍率は、設定で変えられる。小数の倍率でも、報酬は整数', () => {
    const config = { ...DEFAULT_CONFIG, perfectMultiplier: 1.5 };
    expect(settle('perfect', 101, config).awarded).toBe(151);
  });

  it.each([-1, 2.5, Number.NaN])('ポイントが %s なら DomainError', (points) => {
    expect(() => settle('success', points, DEFAULT_CONFIG)).toThrow(
      DomainError
    );
  });
});
