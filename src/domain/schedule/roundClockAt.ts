import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';
import type { Phase } from '../types';
import type { RoundClock } from './types';

/**
 * サーバー時刻から、いまが第何回の、どの段階かを計算する。
 *
 * 誰かが開始時刻を書き込むのではなく、全員(と、データベースのセキュリティルール)が同じ計算をする。
 * 時刻の基準は、Unix 時刻の0(docs/functional-design.md「1. 時計から段階を計算する」)。
 *
 * @param serverMs - 補正したサーバー時刻(ミリ秒。0以上の整数)
 * @param config - 設定値(gatherMs・playMs・resultMs・bonusDurationMs を使う)
 * @returns 回の番号、段階、各時刻
 * @throws DomainError - serverMs が0以上の整数でないとき
 */
export function roundClockAt(serverMs: number, config: GameConfig): RoundClock {
  if (!Number.isSafeInteger(serverMs) || serverMs < 0) {
    throw new DomainError(`サーバー時刻が不正です: ${serverMs}`);
  }

  const { gatherMs, playMs, resultMs, bonusDurationMs } = config;
  const cycleMs = gatherMs + playMs + resultMs;
  const roundIndex = Math.floor(serverMs / cycleMs);
  const roundStartsAt = roundIndex * cycleMs;
  const offset = serverMs - roundStartsAt;

  const playStartsAt = roundStartsAt + gatherMs;
  const playEndsAt = playStartsAt + playMs;
  const nextRoundStartsAt = roundStartsAt + cycleMs;

  const phase: Phase =
    offset < gatherMs
      ? 'gathering'
      : offset < gatherMs + playMs
        ? 'playing'
        : 'result';
  const phaseStartsAt =
    phase === 'gathering'
      ? roundStartsAt
      : phase === 'playing'
        ? playStartsAt
        : playEndsAt;
  const phaseEndsAt =
    phase === 'gathering'
      ? playStartsAt
      : phase === 'playing'
        ? playEndsAt
        : nextRoundStartsAt;

  return {
    roundIndex,
    phase,
    phaseStartsAt,
    phaseEndsAt,
    playStartsAt,
    playEndsAt,
    bonusStartsAt: playEndsAt - bonusDurationMs,
    nextRoundStartsAt,
  };
}

/**
 * 回の番号を、データベースのキーにする。
 *
 * セキュリティルールも、`'' + (now - now % 周期) / 周期` で同じ文字列を作って照合するので、
 * 10進の文字列にする(例: 4928211 → "4928211")。
 *
 * @throws DomainError - roundIndex が0以上の整数でないとき
 */
export function roundId(roundIndex: number): string {
  if (!Number.isSafeInteger(roundIndex) || roundIndex < 0) {
    throw new DomainError(`回の番号が不正です: ${roundIndex}`);
  }
  return String(roundIndex);
}
