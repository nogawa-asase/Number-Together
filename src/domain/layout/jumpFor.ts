import type { Pulse } from '../types';
import type { StageMetrics } from './stageMetrics';

/** 小人の跳ね方(高さと1回の時間は、だれでも同じ。StageMetrics の hopHeightPx・hopDurationMs) */
export interface Jump {
  /** 跳ねる動きを、最初からやり直す間隔。1回の時間より短いと、途中で切られてピクピク動く */
  readonly intervalMs: number;
}

/**
 * 最新の合図から、小人の跳ね方を求める(docs/functional-design.md「10. 小人の舞台」)。
 *
 * 合図が直近 jumpFreshMs(1.5秒)以内なら、power に応じた間隔で、跳ねる動きをやり直す(強く押す人ほど、
 * 途中で切られて、ピクピク動く。自分が連打したときと同じ見え方)。+1か−1かは分からない。
 * 合図は、他の人が書いた値なので、壊れていても例外にせず、跳ねないことにする。
 * 自分の小人は、合図を待たず、押した瞬間に跳ねる(UI層で扱う)。
 *
 * @param pulse - そのプレイヤーの最新の合図。まだなければ null
 * @param nowMs - いまのサーバー時刻
 * @param metrics - 舞台の寸法(jumpFreshMs・hopIntervalsMs を使う)
 * @returns 跳ねるなら、その跳ね方。跳ねないなら null
 */
export function jumpFor(
  pulse: Pulse | null,
  nowMs: number,
  metrics: StageMetrics
): Jump | null {
  if (pulse === null || !Number.isFinite(pulse.t)) {
    return null;
  }
  // 端末の時計のずれで、合図の時刻が少し未来になることがあるので、前後とも jumpFreshMs まで許す
  if (Math.abs(nowMs - pulse.t) > metrics.jumpFreshMs) {
    return null;
  }
  const { power } = pulse;
  if (power !== 1 && power !== 2 && power !== 3) {
    return null;
  }
  return { intervalMs: metrics.hopIntervalsMs[power - 1] };
}
