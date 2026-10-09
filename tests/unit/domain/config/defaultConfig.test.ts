import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import type { TitleId } from '../../../../src/domain/types';
import { statsOf } from '../../fixtures/stats';

function firstTitle(...args: Parameters<typeof statsOf>): TitleId | undefined {
  const stats = statsOf(...args);
  return DEFAULT_CONFIG.titleRules.find((rule) => rule.when(stats))?.id;
}

describe('DEFAULT_CONFIG', () => {
  it('機能設計書の初期値と一致する', () => {
    // Given / When: 既定の設定(称号の条件は、関数なので、下の「称号の条件」で確かめる)
    const { titleRules, ...values } = DEFAULT_CONFIG;

    // Then: functional-design.md「設定値(GameConfig)」の初期値
    expect(titleRules).toHaveLength(4);
    expect(values).toEqual({
      gatherMs: 30_000,
      playMs: 300_000,
      resultMs: 30_000,
      joinCutoffMs: 60_000,
      pointsGraceMs: 3_000,
      startCountdownMs: 3_000,
      finalCountdownMs: 10_000,
      perPlayerTarget: 200,
      rangeRatio: 0.1,
      bonusDurationMs: 60_000,
      bonusMultiplier: 3,
      perfectMultiplier: 2,
      pointCap: null,
      roomCapacity: 20,
      aiFillTo: 5,
      batchMs: 200,
      maxDeltaPerWrite: 50,
      pulseIntervalMs: 1_000,
      pulsePowerSteps: [1, 3, 6],
      reconnectGraceMs: 60_000,
      retryMs: 10_000,
      initialConnectTimeoutMs: 5_000,
      offlineScreenDelayMs: 3_000,
      pastWindowMs: 120_000,
      futureWindowMs: 60_000,
      resultTopN: 7,
      nameMaxUnits: 12,
      roundsToKeep: 2,
    });
  });

  it('1周は360秒になる', () => {
    const { gatherMs, playMs, resultMs } = DEFAULT_CONFIG;
    expect(gatherMs + playMs + resultMs).toBe(360_000);
  });

  it('ポイントの猶予は、結果発表より短い(猶予が次の回にかからない)', () => {
    expect(DEFAULT_CONFIG.pointsGraceMs).toBeLessThan(DEFAULT_CONFIG.resultMs);
  });

  it('倍増タイムと途中参加の締め切りは、ゲームの長さより短い', () => {
    expect(DEFAULT_CONFIG.bonusDurationMs).toBeLessThan(DEFAULT_CONFIG.playMs);
    expect(DEFAULT_CONFIG.joinCutoffMs).toBeLessThan(DEFAULT_CONFIG.playMs);
  });

  it('合図の強さの段階は、小さい順に並ぶ', () => {
    const [one, two, three] = DEFAULT_CONFIG.pulsePowerSteps;
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(three);
  });

  describe('称号の条件', () => {
    it('ぴったり成功が5回以上なら、ぴったり王', () => {
      expect(firstTitle({ perfects: 5 })).toBe('perfectKing');
    });

    it('ぴったり成功が4回で、累計ポイントが2000以上なら、欲張り', () => {
      expect(firstTitle({ perfects: 4, totalPoints: 2000 })).toBe('hoarder');
    });

    it('累計ポイントが1999で、参加が20回以上なら、常連', () => {
      expect(firstTitle({ totalPoints: 1999, plays: 20 })).toBe('regular');
    });

    it('どれにも合わなければ、新人', () => {
      expect(firstTitle({ plays: 19 })).toBe('rookie');
    });

    it('条件が重なったときは、上の条件(ぴったり王)が優先される', () => {
      expect(firstTitle({ perfects: 5, totalPoints: 9999, plays: 99 })).toBe(
        'perfectKing'
      );
    });
  });
});
