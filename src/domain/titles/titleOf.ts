import type { GameConfig } from '../config/types';
import type { Stats, TitleId } from '../types';

/**
 * 実績から、称号を決める(docs/functional-design.md「Titles(称号)」)。
 *
 * 設定値の titleRules を上から順に調べ、最初に合ったものを採用する。
 * どれにも合わなければ、新人(rookie)にする。
 *
 * @param stats - 実績
 * @param config - 設定値(titleRules を使う)
 */
export function titleOf(stats: Stats, config: GameConfig): TitleId {
  return config.titleRules.find((rule) => rule.when(stats))?.id ?? 'rookie';
}
