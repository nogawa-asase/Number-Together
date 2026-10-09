import { DEFAULT_CONFIG } from './defaultConfig';
import type { GameConfig } from './types';

/**
 * 短い周期の設定値(1周10秒)。エミュレータを使うテスト(ルール・結合・E2E)と、手元での動作確認に使う。
 *
 * データベースのルールは、サーバーの時刻で段階を決めるので、本物の周期(6分)のままでは、
 * 段階を待つのに数分かかる。テストでは、ルールの時刻の数値も、同じ値に置き換えて読み込ませる
 * (tests/support/testCycle.ts の scaledRules)。本番では使わない。
 */
export const QUICK_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  gatherMs: 2_000,
  playMs: 6_000,
  resultMs: 2_000,
  pointsGraceMs: 500,
  joinCutoffMs: 1_000,
  bonusDurationMs: 2_000,
  startCountdownMs: 1_000,
  finalCountdownMs: 1_000,
};
