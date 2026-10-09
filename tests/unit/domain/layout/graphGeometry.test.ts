import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import {
  graphMarkers,
  graphPoints,
  graphX,
  graphY,
  NOW_X,
} from '../../../../src/domain/layout/graphGeometry';
import { roundClockAt } from '../../../../src/domain/schedule/roundClockAt';

const START = 4_928_211 * 360_000; // ある回の集合が始まる時刻
const PLAY_START = START + 30_000;
const BONUS_START = START + 270_000;
const PLAY_END = START + 330_000;

describe('graphY', () => {
  it.each([
    [1_000, 23.1], // 目標
    [900, 30.8], // 下端
    [1_100, 15.4], // 上端
  ])('目標1,000で、%i は約 %f%%(機能設計書の値)', (value, expected) => {
    expect(graphY(value, 1_000)).toBeCloseTo(expected, 1);
  });

  it('値0は下端(100%)、目標×1.3は上端(0%)', () => {
    expect(graphY(0, 1_000)).toBe(100);
    expect(graphY(1_300, 1_000)).toBeCloseTo(0, 10);
  });

  it('目標が変わっても、目標の位置は同じ(尺度を取り直す)', () => {
    expect(graphY(4_000, 4_000)).toBeCloseTo(graphY(1_000, 1_000), 10);
  });

  it('窓の外の値は、はみ出したまま返す', () => {
    expect(graphY(1_400, 1_000)).toBeLessThan(0);
    expect(graphY(-50, 1_000)).toBeGreaterThan(100);
  });

  it.each([0, -1, 1.5])('目標が %s なら DomainError', (target) => {
    expect(() => graphY(500, target)).toThrow(DomainError);
  });
});

describe('graphX', () => {
  const now = PLAY_START + 100_000;

  it.each([
    [0, NOW_X], // いま
    [60_000, 100], // 1分後(未来の窓の右端)
    [30_000, NOW_X + (100 - NOW_X) / 2],
    [-120_000, 0], // 2分前(過去の窓の左端)
    [-60_000, NOW_X / 2],
  ])('いまから %i ミリ秒の時刻は %f%%', (offset, expected) => {
    expect(graphX(now + offset, now, DEFAULT_CONFIG)).toBeCloseTo(expected, 10);
  });

  it('いまは 66.667%', () => {
    expect(NOW_X).toBeCloseTo(66.667, 3);
  });
});

describe('graphPoints', () => {
  const now = PLAY_START + 200_000;
  const target = 1_000;
  const xOf = (t: number) => graphX(t, now, DEFAULT_CONFIG);
  const yOf = (v: number) => graphY(v, target);

  it('標本がなければ、空', () => {
    expect(graphPoints([], now, target, DEFAULT_CONFIG)).toEqual([]);
  });

  it('窓の中の標本を描き、最後に「いま」の点を足す', () => {
    const points = graphPoints(
      [
        { t: now - 10_000, value: 900 },
        { t: now - 5_000, value: 950 },
      ],
      now,
      target,
      DEFAULT_CONFIG
    );
    expect(points).toEqual([
      { x: xOf(now - 10_000), y: yOf(900) },
      { x: xOf(now - 5_000), y: yOf(950) },
      { x: NOW_X, y: yOf(950) },
    ]);
  });

  it('「いま」ちょうどの標本があれば、点を重ねない', () => {
    const points = graphPoints(
      [{ t: now, value: 990 }],
      now,
      target,
      DEFAULT_CONFIG
    );
    expect(points).toEqual([{ x: NOW_X, y: yOf(990) }]);
  });

  it('窓より前の標本は、直前の1つだけを、左端に置いてつなぐ', () => {
    const points = graphPoints(
      [
        { t: now - 200_000, value: 100 },
        { t: now - 130_000, value: 400 },
        { t: now - 60_000, value: 700 },
      ],
      now,
      target,
      DEFAULT_CONFIG
    );
    expect(points).toEqual([
      { x: 0, y: yOf(400) },
      { x: xOf(now - 60_000), y: yOf(700) },
      { x: NOW_X, y: yOf(700) },
    ]);
  });

  it('窓の始まりちょうどの標本は、窓の中として描く', () => {
    const points = graphPoints(
      [
        { t: now - 130_000, value: 400 },
        { t: now - 120_000, value: 500 },
      ],
      now,
      target,
      DEFAULT_CONFIG
    );
    expect(points.slice(0, 2)).toEqual([
      { x: 0, y: yOf(400) },
      { x: 0, y: yOf(500) },
    ]);
  });

  it('いまより後の標本(時計のずれ)は、使わない', () => {
    const points = graphPoints(
      [
        { t: now - 1_000, value: 800 },
        { t: now + 500, value: 999 },
      ],
      now,
      target,
      DEFAULT_CONFIG
    );
    expect(points.map((point) => point.y)).toEqual([yOf(800), yOf(800)]);
  });
});

describe('graphMarkers', () => {
  function markersAt(nowMs: number) {
    return graphMarkers(
      nowMs,
      roundClockAt(nowMs, DEFAULT_CONFIG),
      DEFAULT_CONFIG
    );
  }

  it('倍増タイムが未来の窓より先なら、帯も終了の線も出さない', () => {
    expect(markersAt(PLAY_START)).toEqual({ bonusBand: null, endLineX: null });
  });

  it('倍増タイムの開始が窓に入ったら、そこから右端まで帯を出す', () => {
    // 残り1分30秒: 倍増タイムは30秒後から。終了は窓の外
    const markers = markersAt(PLAY_END - 90_000);
    expect(markers.bonusBand?.fromX).toBeCloseTo(NOW_X + (100 - NOW_X) / 2, 10);
    expect(markers.bonusBand?.toX).toBe(100);
    expect(markers.endLineX).toBeNull();
  });

  it('倍増タイムの開始ちょうどは、帯がいまから始まり、終了の線が右端に出る', () => {
    expect(markersAt(BONUS_START)).toEqual({
      bonusBand: { fromX: NOW_X, toX: 100 },
      endLineX: 100,
    });
  });

  it('倍増タイム中は、帯がいまから終了まで。終了の線が近づく', () => {
    const markers = markersAt(PLAY_END - 30_000);
    const endX = NOW_X + (100 - NOW_X) / 2;
    expect(markers.bonusBand?.fromX).toBe(NOW_X);
    expect(markers.bonusBand?.toX).toBeCloseTo(endX, 10);
    expect(markers.endLineX).toBeCloseTo(endX, 10);
  });

  it('終了ちょうどからは、帯も終了の線も出さない', () => {
    expect(markersAt(PLAY_END)).toEqual({ bonusBand: null, endLineX: null });
  });
});
