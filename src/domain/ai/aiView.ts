import type { GameConfig } from '../config/types';
import type { RoundClock } from '../schedule/types';
import { rangeFor } from '../targets/rangeFor';
import type { AiParams } from './aiParams';
import type { Random } from './random';

/** AIが見る状態(docs/functional-design.md「AiBrain」) */
export interface AiView {
  readonly number: number; // AIが「見ている」数字(反応の遅れを表すため、少し前の値)
  readonly target: number;
  readonly lower: number;
  readonly upper: number;
  readonly remainingMs: number; // ゲーム終了までの残り
  readonly bonusActive: boolean;
  readonly elapsedRatio: number; // ゲームの経過の割合(0〜1)
}

/** aiViewAt の入力 */
export interface AiViewInput {
  readonly number: number; // AIに見せる数字(reactionDelayMs だけ前の値)
  readonly target: number;
  readonly nowMs: number; // いまのサーバー時刻
  readonly clock: RoundClock; // nowMs から計算した、いまの回
}

/**
 * AIが見る状態を求める。範囲の端は、人間と同じ rangeFor で求める。
 *
 * @param input - 見せる数字、目標、時刻、回の時計
 * @param config - 設定値(rangeRatio を使う)
 */
export function aiViewAt(input: AiViewInput, config: GameConfig): AiView {
  const { number, target, nowMs, clock } = input;
  const { lower, upper } = rangeFor(target, config);
  const playMs = clock.playEndsAt - clock.playStartsAt;
  const elapsedRatio = Math.min(
    1,
    Math.max(0, (nowMs - clock.playStartsAt) / playMs)
  );

  return {
    number,
    target,
    lower,
    upper,
    remainingMs: Math.max(0, clock.playEndsAt - nowMs),
    bonusActive: clock.bonusStartsAt <= nowMs && nowMs < clock.playEndsAt,
    elapsedRatio,
  };
}

/**
 * AIの反応の遅れを選ぶ。AIは、この時間だけ前の数字を見る(人間と同じく、すぐには反応できない)。
 *
 * @param random - 乱数
 * @param params - AIの設定値(reactionDelayMinMs・reactionDelayMaxMs を使う)
 * @returns min 以上 max 以下の整数(ミリ秒)
 */
export function reactionDelayMs(random: Random, params: AiParams): number {
  const { reactionDelayMinMs: min, reactionDelayMaxMs: max } = params;
  return min + Math.floor(random.next() * (max - min + 1));
}
