import type { GameConfig } from '../config/types';
import { DomainError } from '../errors';
import type { RoundClock } from '../schedule/types';

/** グラフの上端(0%)の値の、目標に対する倍率。下端(100%)は値0 */
const TOP_RATIO = 1.3;

/** 「いま」の横の位置(%)。右から1/3 */
export const NOW_X = 200 / 3;

/** 数字の標本(クライアントが、届いた値を時刻と一緒に覚えたもの) */
export interface GraphSample {
  readonly t: number; // サーバー時刻
  readonly value: number;
}

/** グラフの点(縦横とも、グラフの左上を0とする%) */
export interface GraphPoint {
  readonly x: number;
  readonly y: number;
}

/** 倍増タイムの帯と、終了の線の位置 */
export interface GraphMarkers {
  readonly bonusBand: { readonly fromX: number; readonly toX: number } | null;
  readonly endLineX: number | null;
}

/**
 * 値を、縦の位置(%)にする(docs/functional-design.md「9. グラフの描画」)。
 *
 * 値0が下端(100%)、目標×1.3が上端(0%)。目標は約23.1%、±10%の範囲の端は約30.8%と約15.4%になる。
 * 窓の外の値は、はみ出したまま返す(切り取りは、描画側で行う)。
 *
 * @param value - 値
 * @param target - 目標(1以上の整数)
 * @throws DomainError - target が1以上の整数でないとき
 */
export function graphY(value: number, target: number): number {
  if (!Number.isSafeInteger(target) || target < 1) {
    throw new DomainError(`目標が不正です: ${target}`);
  }
  return (1 - value / (TOP_RATIO * target)) * 100;
}

/**
 * 時刻を、横の位置(%)にする(docs/functional-design.md「9. グラフの描画」)。
 *
 * 「いま」が 66.667%。過去は pastWindowMs 前が 0%、未来は futureWindowMs 後が 100%。
 *
 * @param t - 時刻
 * @param nowMs - いまのサーバー時刻
 * @param config - 設定値(pastWindowMs・futureWindowMs を使う)
 */
export function graphX(t: number, nowMs: number, config: GameConfig): number {
  return t >= nowMs
    ? NOW_X + ((t - nowMs) / config.futureWindowMs) * (100 - NOW_X)
    : NOW_X - ((nowMs - t) / config.pastWindowMs) * NOW_X;
}

/**
 * 数字の標本から、「いま」までの線の点を求める。
 *
 * 窓の始まり(pastWindowMs 前)より前の標本は、直前の1つだけを、窓の左端に置いてつなぐ。
 * 最後に、「いま」の点(最新の値)を足す。いまより後の標本は使わない。
 * 途中参加の人は、参加した時点から標本を持つので、線も、そこから始まる。
 *
 * @param samples - 標本(時刻の順)
 * @param nowMs - いまのサーバー時刻
 * @param target - いまの目標(過去の線も、この目標で尺度を取り直す)
 * @param config - 設定値(pastWindowMs・futureWindowMs を使う)
 */
export function graphPoints(
  samples: readonly GraphSample[],
  nowMs: number,
  target: number,
  config: GameConfig
): GraphPoint[] {
  const windowStart = nowMs - config.pastWindowMs;
  const visible: GraphSample[] = [];
  let before: GraphSample | null = null;
  for (const sample of samples) {
    if (sample.t > nowMs) break;
    if (sample.t < windowStart) {
      before = sample;
    } else {
      visible.push(sample);
    }
  }
  if (before !== null) {
    visible.unshift({ t: windowStart, value: before.value });
  }
  const latest = visible.at(-1);
  if (latest === undefined) {
    return [];
  }
  if (latest.t < nowMs) {
    visible.push({ t: nowMs, value: latest.value });
  }
  return visible.map((sample) => ({
    x: graphX(sample.t, nowMs, config),
    y: graphY(sample.value, target),
  }));
}

/**
 * 未来の部分に描く、倍増タイムの帯と、終了の線の位置を求める。
 *
 * - 帯: 倍増タイム(bonusStartsAt〜playEndsAt)のうち、いまより後の部分。倍増タイム中は、いまから始まる。
 *   右端(100%)を超える分は切る。見えなければ null
 * - 終了の線: playEndsAt が未来の窓(いま〜futureWindowMs 後)に入ったときだけ
 *
 * @param nowMs - いまのサーバー時刻
 * @param clock - nowMs から計算した、いまの回
 * @param config - 設定値(futureWindowMs・pastWindowMs を使う)
 */
export function graphMarkers(
  nowMs: number,
  clock: RoundClock,
  config: GameConfig
): GraphMarkers {
  const windowEnd = nowMs + config.futureWindowMs;
  const from = Math.max(nowMs, clock.bonusStartsAt);
  const to = Math.min(windowEnd, clock.playEndsAt);
  const bonusBand =
    from < to
      ? { fromX: graphX(from, nowMs, config), toX: graphX(to, nowMs, config) }
      : null;
  const endLineX =
    nowMs < clock.playEndsAt && clock.playEndsAt <= windowEnd
      ? graphX(clock.playEndsAt, nowMs, config)
      : null;
  return { bonusBand, endLineX };
}
