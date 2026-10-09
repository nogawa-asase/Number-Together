import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { DomainError } from '../../../../src/domain/errors';
import {
  roundClockAt,
  roundId,
} from '../../../../src/domain/schedule/roundClockAt';

const CYCLE = 360_000; // 30秒 + 5分 + 30秒
const ROUND = 4_928_211; // 2026年ごろの回の番号
const START = ROUND * CYCLE; // この回の集合が始まる時刻

describe('roundClockAt', () => {
  it('回の始まりちょうどは、集合中', () => {
    // Given / When
    const clock = roundClockAt(START, DEFAULT_CONFIG);

    // Then
    expect(clock).toEqual({
      roundIndex: ROUND,
      phase: 'gathering',
      phaseStartsAt: START,
      phaseEndsAt: START + 30_000,
      playStartsAt: START + 30_000,
      playEndsAt: START + 330_000,
      bonusStartsAt: START + 270_000,
      nextRoundStartsAt: START + CYCLE,
    });
  });

  it('ゲーム開始の1ミリ秒前は、まだ集合中', () => {
    expect(roundClockAt(START + 29_999, DEFAULT_CONFIG).phase).toBe(
      'gathering'
    );
  });

  it('ゲーム開始ちょうどは、ゲーム中', () => {
    const clock = roundClockAt(START + 30_000, DEFAULT_CONFIG);
    expect(clock.phase).toBe('playing');
    expect(clock.phaseStartsAt).toBe(START + 30_000);
    expect(clock.phaseEndsAt).toBe(START + 330_000);
  });

  it('ゲーム終了の1ミリ秒前は、まだゲーム中', () => {
    expect(roundClockAt(START + 329_999, DEFAULT_CONFIG).phase).toBe('playing');
  });

  it('ゲーム終了ちょうどは、結果発表', () => {
    const clock = roundClockAt(START + 330_000, DEFAULT_CONFIG);
    expect(clock.phase).toBe('result');
    expect(clock.phaseStartsAt).toBe(START + 330_000);
    expect(clock.phaseEndsAt).toBe(START + CYCLE);
  });

  it('次の回の始まりの1ミリ秒前は、まだ同じ回の結果発表', () => {
    const clock = roundClockAt(START + CYCLE - 1, DEFAULT_CONFIG);
    expect(clock.roundIndex).toBe(ROUND);
    expect(clock.phase).toBe('result');
  });

  it('次の回の始まりちょうどは、次の回の集合中', () => {
    const clock = roundClockAt(START + CYCLE, DEFAULT_CONFIG);
    expect(clock.roundIndex).toBe(ROUND + 1);
    expect(clock.phase).toBe('gathering');
  });

  it('倍増タイムは、ゲーム終了の bonusDurationMs 前から', () => {
    const config = { ...DEFAULT_CONFIG, bonusDurationMs: 30_000 };
    expect(roundClockAt(START, config).bonusStartsAt).toBe(START + 300_000);
  });

  it('設定で長さを変えると、段階の切り替わりも変わる', () => {
    // Given: ゲームを3分にした設定(1周 = 30秒 + 3分 + 30秒 = 240秒)
    const config = { ...DEFAULT_CONFIG, playMs: 180_000 };

    // When
    const clock = roundClockAt(240_000 + 210_000, config);

    // Then: 2回目(番号1)の、ゲーム終了ちょうど
    expect(clock.roundIndex).toBe(1);
    expect(clock.phase).toBe('result');
    expect(clock.playEndsAt).toBe(240_000 + 210_000);
  });

  it('時刻の基準(0)は、第0回の集合の始まり', () => {
    const clock = roundClockAt(0, DEFAULT_CONFIG);
    expect(clock.roundIndex).toBe(0);
    expect(clock.phase).toBe('gathering');
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '時刻が0以上の整数でない(%s)ときは、例外になる',
    (serverMs) => {
      expect(() => roundClockAt(serverMs, DEFAULT_CONFIG)).toThrow(DomainError);
    }
  );
});

describe('roundId', () => {
  it('回の番号を、10進の文字列にする', () => {
    expect(roundId(ROUND)).toBe('4928211');
    expect(roundId(0)).toBe('0');
  });

  it('セキュリティルールの式と同じ文字列になる', () => {
    // ルールは `'' + (now - now % 360000) / 360000` で、いまの回の roundId を作る
    const now = START + 123_456;
    const fromRules = '' + (now - (now % CYCLE)) / CYCLE;
    expect(roundId(roundClockAt(now, DEFAULT_CONFIG).roundIndex)).toBe(
      fromRules
    );
  });

  it.each([-1, 2.5, Number.NaN])(
    '回の番号が0以上の整数でない(%s)ときは、例外になる',
    (index) => {
      expect(() => roundId(index)).toThrow(DomainError);
    }
  );
});
