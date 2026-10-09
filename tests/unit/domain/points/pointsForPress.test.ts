import { describe, expect, it } from 'vitest';
import type { GameConfig } from '../../../../src/domain/config/types';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import { pointsForPress } from '../../../../src/domain/points/pointsForPress';
import type { PressInput } from '../../../../src/domain/points/types';
import { roundClockAt } from '../../../../src/domain/schedule/roundClockAt';

const START = 4_928_211 * 360_000; // ある回の集合が始まる時刻
const PLAY_START = START + 30_000;
const BONUS_START = START + 270_000; // 終了の1分前
const PLAY_END = START + 330_000;

/** 目標1,000(範囲 900〜1,100)で、+1を押した入力。指定しなかった項目は、倍増タイムの前・範囲の中 */
function press(
  partial: Partial<Omit<PressInput, 'clock'>> = {},
  config: GameConfig = DEFAULT_CONFIG
): number {
  const nowMs = partial.nowMs ?? PLAY_START + 10_000;
  return pointsForPress(
    {
      kind: '+1',
      numberAtPress: 1_000,
      target: 1_000,
      currentPoints: 0,
      ...partial,
      nowMs,
      clock: roundClockAt(nowMs, config),
    },
    config
  );
}

describe('pointsForPress', () => {
  it('+1は1ポイント(倍増タイムの前)', () => {
    expect(press()).toBe(1);
  });

  it('−1は0ポイント', () => {
    expect(press({ kind: '-1' })).toBe(0);
    expect(press({ kind: '-1', nowMs: BONUS_START })).toBe(0);
  });

  describe('倍増タイム', () => {
    it('開始の1ミリ秒前は1ポイント', () => {
      expect(press({ nowMs: BONUS_START - 1 })).toBe(1);
    });

    it('開始ちょうどから、範囲の中なら3ポイント', () => {
      expect(press({ nowMs: BONUS_START })).toBe(3);
    });

    it('終了の直前も3ポイント', () => {
      expect(press({ nowMs: PLAY_END - 1 })).toBe(3);
    });

    it.each([
      [899, 1],
      [900, 3],
      [1_100, 3],
      [1_101, 1],
    ])('押した瞬間の数字が %i なら %iポイント', (numberAtPress, expected) => {
      expect(press({ nowMs: BONUS_START, numberAtPress })).toBe(expected);
    });

    it('倍率は、設定で変えられる', () => {
      const config = { ...DEFAULT_CONFIG, bonusMultiplier: 5 };
      expect(press({ nowMs: BONUS_START }, config)).toBe(5);
    });
  });

  describe('ゲームの外', () => {
    it('ゲーム開始の1ミリ秒前(集合中)は0ポイント', () => {
      expect(press({ nowMs: PLAY_START - 1 })).toBe(0);
    });

    it('ゲーム開始ちょうどは1ポイント', () => {
      expect(press({ nowMs: PLAY_START })).toBe(1);
    });

    it('ゲーム終了ちょうど(結果発表)からは0ポイント', () => {
      expect(press({ nowMs: PLAY_END })).toBe(0);
    });
  });

  describe('上限(pointCap)', () => {
    it('上限がなければ、いくら貯めても増える', () => {
      expect(press({ nowMs: BONUS_START, currentPoints: 1_000_000 })).toBe(3);
    });

    it('上限まで余裕があれば、そのまま増える', () => {
      const config = { ...DEFAULT_CONFIG, pointCap: 100 };
      expect(press({ nowMs: BONUS_START, currentPoints: 97 }, config)).toBe(3);
    });

    it('上限を超える分は、増えない', () => {
      const config = { ...DEFAULT_CONFIG, pointCap: 100 };
      expect(press({ nowMs: BONUS_START, currentPoints: 98 }, config)).toBe(2);
    });

    it('上限ちょうどなら、0ポイント', () => {
      const config = { ...DEFAULT_CONFIG, pointCap: 100 };
      expect(press({ currentPoints: 100 }, config)).toBe(0);
    });

    it('上限を超えていても、負にはならない', () => {
      const config = { ...DEFAULT_CONFIG, pointCap: 100 };
      expect(press({ currentPoints: 150 }, config)).toBe(0);
    });
  });

  describe('不正な入力', () => {
    it.each([1.5, Number.NaN])(
      '押した瞬間の数字が %s なら DomainError',
      (n) => {
        expect(() => press({ numberAtPress: n })).toThrow(DomainError);
      }
    );

    it.each([-1, 0.5])('貯めたポイントが %s なら DomainError', (p) => {
      expect(() => press({ currentPoints: p })).toThrow(DomainError);
    });
  });
});
