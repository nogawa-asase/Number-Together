import type { Pulse } from '../types';
import type { StageMetrics } from './stageMetrics';

/** 小人の跳ね方 */
export interface Jump {
  readonly heightPx: number; // 跳ねる高さ
  readonly durationMs: number; // 1回の跳ねる時間(短いほど速い)
}

/**
 * 最新の合図から、小人の跳ね方を求める(docs/functional-design.md「10. 小人の舞台」)。
 *
 * 合図が直近 jumpFreshMs(1.5秒)以内なら、power に応じた高さと速さで跳ねる。+1か−1かは分からない。
 * 合図は、他の人が書いた値なので、壊れていても例外にせず、跳ねないことにする。
 * 自分の小人は、合図を待たず、押した瞬間に跳ねる(UI層で扱う)。
 *
 * @param pulse - そのプレイヤーの最新の合図。まだなければ null
 * @param nowMs - いまのサーバー時刻
 * @param metrics - 舞台の寸法(jumpFreshMs・jumpHeightsPx・jumpDurationsMs を使う)
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
  return {
    heightPx: metrics.jumpHeightsPx[power - 1],
    durationMs: metrics.jumpDurationsMs[power - 1],
  };
}
