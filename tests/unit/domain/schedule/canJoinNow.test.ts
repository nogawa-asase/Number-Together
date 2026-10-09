import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { canJoinNow } from '../../../../src/domain/schedule/canJoinNow';
import { roundClockAt } from '../../../../src/domain/schedule/roundClockAt';

const START = 4_928_211 * 360_000; // ある回の集合が始まる時刻
const PLAY_END = START + 330_000; // その回のゲーム終了

function verdictAt(serverMs: number) {
  return canJoinNow(
    roundClockAt(serverMs, DEFAULT_CONFIG),
    serverMs,
    DEFAULT_CONFIG
  );
}

describe('canJoinNow', () => {
  it('集合中は、参加できる', () => {
    expect(verdictAt(START)).toEqual({ ok: true });
    expect(verdictAt(START + 29_999)).toEqual({ ok: true });
  });

  it('ゲーム開始ちょうどは、参加できる', () => {
    expect(verdictAt(START + 30_000)).toEqual({ ok: true });
  });

  it('終了の1分前の1ミリ秒前は、まだ参加できる', () => {
    expect(verdictAt(PLAY_END - 60_001)).toEqual({ ok: true });
  });

  it('終了の1分前ちょうどからは、参加できない', () => {
    expect(verdictAt(PLAY_END - 60_000)).toEqual({
      ok: false,
      reason: 'lastMinute',
    });
  });

  it('終了の直前も、参加できない', () => {
    expect(verdictAt(PLAY_END - 1)).toEqual({
      ok: false,
      reason: 'lastMinute',
    });
  });

  it('結果発表中は、参加できない(次の回の集合を待つ)', () => {
    expect(verdictAt(PLAY_END)).toEqual({ ok: false, reason: 'lastMinute' });
    expect(verdictAt(START + 359_999)).toEqual({
      ok: false,
      reason: 'lastMinute',
    });
  });

  it('締め切りの長さは、設定で変えられる', () => {
    // Given: 終了の2分前から入れない設定
    const config = { ...DEFAULT_CONFIG, joinCutoffMs: 120_000 };
    const serverMs = PLAY_END - 90_000;

    // When
    const verdict = canJoinNow(
      roundClockAt(serverMs, config),
      serverMs,
      config
    );

    // Then
    expect(verdict).toEqual({ ok: false, reason: 'lastMinute' });
  });
});
