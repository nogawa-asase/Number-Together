import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../src/domain/errors';
import { stageLayout } from '../../../../src/domain/layout/stageLayout';
import { DEFAULT_STAGE_METRICS as METRICS } from '../../../../src/domain/layout/stageMetrics';

function layout(
  count: number,
  myIndex: number | null = null,
  stageWidthPx = 308
) {
  return stageLayout({ count, myIndex, stageWidthPx }, METRICS);
}

describe('stageLayout', () => {
  describe('20人(見本 05-play.html と同じ位置)', () => {
    const slots = layout(20, 5);

    it('左から 6.2px、14.4px 間隔で並ぶ', () => {
      slots.forEach((slot, i) => {
        expect(slot.leftPx).toBeCloseTo(6.2 + 14.4 * i, 6);
      });
    });

    it('偶数番目は奥(下から22px)、奇数番目は手前(15px)', () => {
      expect(slots[0]).toMatchObject({
        depth: 'back',
        bottomPx: 22,
        zIndex: 1,
      });
      expect(slots[1]).toMatchObject({
        depth: 'front',
        bottomPx: 15,
        zIndex: 2,
      });
    });

    it('自分(6人目)は、手前の高さのまま、いちばん上に重なる', () => {
      expect(slots[5]).toMatchObject({
        depth: 'front',
        bottomPx: 15,
        zIndex: 3,
      });
      expect(slots[5]?.leftPx).toBeCloseTo(78.2, 6);
    });

    it('隣どうしは、体の約1/3ずつ重なる', () => {
      const overlap = METRICS.bodyWidthPx - 14.4;
      expect(overlap / METRICS.bodyWidthPx).toBeCloseTo(1 / 3, 1);
    });
  });

  it('人数が少なければ、重ならない間隔(28px)で、中央に寄せる', () => {
    const slots = layout(5);
    // 全体の幅 22 + 4 × 28 = 134、左端 (308 − 134) / 2 = 87
    expect(slots.map((slot) => slot.leftPx)).toEqual([87, 115, 143, 171, 199]);
  });

  it('1人なら、中央', () => {
    expect(layout(1)).toEqual([
      { leftPx: 143, bottomPx: 22, depth: 'back', zIndex: 1 },
    ]);
  });

  it('0人なら、空', () => {
    expect(layout(0)).toEqual([]);
  });

  it('幅360pxの画面(舞台278px)でも、両端の余白をそろえて収まる', () => {
    const slots = layout(20, null, 278);
    expect(slots[0]?.leftPx).toBeCloseTo(6.2, 6);
    const last = slots[19]!;
    expect(278 - (last.leftPx + METRICS.bodyWidthPx)).toBeCloseTo(6.2, 6);
  });

  it.each([
    [{ count: -1, myIndex: null, stageWidthPx: 308 }],
    [{ count: 1.5, myIndex: null, stageWidthPx: 308 }],
    [{ count: 3, myIndex: 3, stageWidthPx: 308 }],
    [{ count: 3, myIndex: -1, stageWidthPx: 308 }],
    [{ count: 3, myIndex: 0.5, stageWidthPx: 308 }],
    [{ count: 3, myIndex: null, stageWidthPx: 0 }],
    [{ count: 3, myIndex: null, stageWidthPx: Number.NaN }],
  ])('不正な入力 %o は DomainError', (input) => {
    expect(() => stageLayout(input, METRICS)).toThrow(DomainError);
  });
});
