import { describe, expect, it } from 'vitest';
import { jumpFor } from '../../../../src/domain/layout/jumpFor';
import { DEFAULT_STAGE_METRICS as METRICS } from '../../../../src/domain/layout/stageMetrics';
import type { Pulse } from '../../../../src/domain/types';

const NOW = 1_000_000;

describe('jumpFor', () => {
  it.each([
    [1, 700],
    [2, 250],
    [3, 140],
  ])(
    'power %i なら、%i ミリ秒ごとに跳ね直す(強いほど短い)',
    (power, intervalMs) => {
      expect(jumpFor({ t: NOW - 100, power }, NOW, METRICS)).toEqual({
        intervalMs,
      });
    }
  );

  it('power 1 は最後まで跳ね、2・3 は途中で切られる(1回の時間より短い間隔)', () => {
    const [one, two, three] = METRICS.hopIntervalsMs;
    expect(one).toBeGreaterThanOrEqual(METRICS.hopDurationMs);
    expect(two).toBeLessThan(METRICS.hopDurationMs);
    expect(three).toBeLessThan(two);
  });

  it('1.5秒前ちょうどの合図は、まだ跳ねる', () => {
    expect(jumpFor({ t: NOW - 1_500, power: 1 }, NOW, METRICS)).not.toBeNull();
  });

  it('1.5秒より古い合図は、跳ねない', () => {
    expect(jumpFor({ t: NOW - 1_501, power: 3 }, NOW, METRICS)).toBeNull();
  });

  it('時計のずれで少し未来の合図も、跳ねる', () => {
    expect(jumpFor({ t: NOW + 300, power: 2 }, NOW, METRICS)).not.toBeNull();
  });

  it('合図がまだなければ、跳ねない', () => {
    expect(jumpFor(null, NOW, METRICS)).toBeNull();
  });

  it('power 0(押していない)は、跳ねない', () => {
    expect(jumpFor({ t: NOW, power: 0 }, NOW, METRICS)).toBeNull();
  });

  it.each([
    ['power が範囲の外', { t: NOW, power: 4 }],
    ['power が負', { t: NOW, power: -1 }],
    ['power が小数', { t: NOW, power: 1.5 }],
    ['power が数でない', { t: NOW, power: '2' } as unknown as Pulse],
    ['時刻が数でない', { t: Number.NaN, power: 2 }],
    ['時刻がずっと未来', { t: NOW + 60_000, power: 2 }],
  ])('%s なら、例外にせず、跳ねない', (_label, pulse) => {
    expect(jumpFor(pulse, NOW, METRICS)).toBeNull();
  });
});
