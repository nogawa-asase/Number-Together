import { describe, expect, it } from 'vitest';
import { jumpFor } from '../../../../src/domain/layout/jumpFor';
import { DEFAULT_STAGE_METRICS as METRICS } from '../../../../src/domain/layout/stageMetrics';
import type { Pulse } from '../../../../src/domain/types';

const NOW = 1_000_000;

describe('jumpFor', () => {
  it.each([
    [1, { heightPx: 14, durationMs: 900 }],
    [2, { heightPx: 20, durationMs: 700 }],
    [3, { heightPx: 26, durationMs: 500 }],
  ])('power %i なら、強いほど高く速く跳ねる', (power, expected) => {
    expect(jumpFor({ t: NOW - 100, power }, NOW, METRICS)).toEqual(expected);
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
