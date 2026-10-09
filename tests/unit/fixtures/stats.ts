import type { Stats } from '../../../src/domain/types';

/** テスト用の実績。指定しなかった項目は0 */
export function statsOf(partial: Partial<Stats> = {}): Stats {
  return {
    plays: 0,
    successes: 0,
    perfects: 0,
    totalPoints: 0,
    lastCountedRound: null,
    ...partial,
  };
}
