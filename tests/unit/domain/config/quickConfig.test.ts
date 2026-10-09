import { describe, expect, it } from 'vitest';
import { QUICK_CONFIG } from '../../../../src/domain/config/quickConfig';

describe('QUICK_CONFIG(短い周期)', () => {
  it('1周10秒で、本物と同じ関係(猶予は結果発表より短い、倍増タイムと締め切りはゲームより短い)を保つ', () => {
    const {
      gatherMs,
      playMs,
      resultMs,
      pointsGraceMs,
      bonusDurationMs,
      joinCutoffMs,
    } = QUICK_CONFIG;
    expect(gatherMs + playMs + resultMs).toBe(10_000);
    expect(pointsGraceMs).toBeLessThan(resultMs);
    expect(bonusDurationMs).toBeLessThan(playMs);
    expect(joinCutoffMs).toBeLessThan(playMs);
  });
});
