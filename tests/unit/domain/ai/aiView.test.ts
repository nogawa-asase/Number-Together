import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_PARAMS } from '../../../../src/domain/ai/aiParams';
import { aiViewAt, reactionDelayMs } from '../../../../src/domain/ai/aiView';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { roundClockAt } from '../../../../src/domain/schedule/roundClockAt';
import { fixedRandom } from '../../fixtures/random';

const START = 4_928_211 * 360_000; // ある回の集合が始まる時刻
const PLAY_START = START + 30_000;
const BONUS_START = START + 270_000;
const PLAY_END = START + 330_000;

function viewAt(nowMs: number, number = 950, target = 1_000) {
  return aiViewAt(
    { number, target, nowMs, clock: roundClockAt(nowMs, DEFAULT_CONFIG) },
    DEFAULT_CONFIG
  );
}

describe('aiViewAt', () => {
  it('見せる数字・目標・範囲の端を入れる', () => {
    expect(viewAt(PLAY_START + 1_000)).toMatchObject({
      number: 950,
      target: 1_000,
      lower: 900,
      upper: 1_100,
    });
  });

  it('ゲーム開始ちょうどは、経過0、残り5分', () => {
    expect(viewAt(PLAY_START)).toMatchObject({
      elapsedRatio: 0,
      remainingMs: 300_000,
      bonusActive: false,
    });
  });

  it('倍増タイムの開始の1ミリ秒前は、倍増タイムではない', () => {
    expect(viewAt(BONUS_START - 1).bonusActive).toBe(false);
  });

  it('倍増タイムの開始ちょうどから、倍増タイム。経過は0.8', () => {
    expect(viewAt(BONUS_START)).toMatchObject({
      bonusActive: true,
      remainingMs: 60_000,
      elapsedRatio: 0.8,
    });
  });

  it('終了の直前は、倍増タイム、残り1ミリ秒', () => {
    expect(viewAt(PLAY_END - 1)).toMatchObject({
      bonusActive: true,
      remainingMs: 1,
    });
  });

  it('終了ちょうどからは、倍増タイムではない。残り0、経過1', () => {
    expect(viewAt(PLAY_END)).toMatchObject({
      bonusActive: false,
      remainingMs: 0,
      elapsedRatio: 1,
    });
  });

  it('ゲームの前(集合中)は、経過0', () => {
    expect(viewAt(START).elapsedRatio).toBe(0);
  });
});

describe('reactionDelayMs', () => {
  it('乱数が0なら、最小の300ミリ秒', () => {
    expect(reactionDelayMs(fixedRandom(0), DEFAULT_AI_PARAMS)).toBe(300);
  });

  it('乱数が1に近ければ、最大の800ミリ秒', () => {
    expect(reactionDelayMs(fixedRandom(0.999_999), DEFAULT_AI_PARAMS)).toBe(
      800
    );
  });

  it('乱数が0.5なら、間の550ミリ秒', () => {
    expect(reactionDelayMs(fixedRandom(0.5), DEFAULT_AI_PARAMS)).toBe(550);
  });
});
