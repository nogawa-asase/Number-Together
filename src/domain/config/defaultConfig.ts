import type { GameConfig } from './types';

/**
 * 設定値の既定。初期値は、PRD・機能設計書の値と同じ。
 *
 * 値を変えるときは、先にドキュメントを直す。セキュリティルールと同じ値を持つ項目
 * (gatherMs・playMs・resultMs・pointsGraceMs・roomCapacity・maxDeltaPerWrite・nameMaxUnits)は、
 * database.rules.json も直す(値の一致は、テストで確かめている)。
 */
export const DEFAULT_CONFIG: GameConfig = {
  // 進行(PRD「開催の流れ」。どれも仮置き)
  gatherMs: 30_000,
  playMs: 300_000,
  resultMs: 30_000,
  joinCutoffMs: 60_000, // 終了の1分前から途中参加できない(PRD「開催の流れ」)
  pointsGraceMs: 3_000, // ポイントの猶予(architecture.md「3秒の猶予」)
  startCountdownMs: 3_000, // 「3」「2」「1」を1秒ずつ出し、開始の時刻に「スタート!」(画面の見本 04)
  finalCountdownMs: 10_000, // 終了10秒前の演出(画面の見本 08)

  // 目標と範囲(PRD「準備」。仮置き)
  perPlayerTarget: 200,
  rangeRatio: 0.1,

  // ポイント(PRD「個人ポイント」。仮置き)
  bonusDurationMs: 60_000, // 倍増タイムは、最後の1分
  bonusMultiplier: 3,
  perfectMultiplier: 2,
  pointCap: null, // 最初は上限なし(PRD「このゲームで決めたこと」)

  // 部屋とAI(PRD「準備」)
  roomCapacity: 20,
  aiFillTo: 5,

  // 通信(PRD機能1・機能11、functional-design.md「設定値」)
  batchMs: 200,
  maxDeltaPerWrite: 50,
  pulseIntervalMs: 1_000,
  pulsePowerSteps: [1, 3, 6], // 仮
  reconnectGraceMs: 60_000, // 仮(PRD「未決定事項」)
  retryMs: 10_000,
  initialConnectTimeoutMs: 5_000,
  offlineScreenDelayMs: 3_000,

  // 表示(PRD機能5・機能4・機能6)
  pastWindowMs: 120_000, // 右から1/3が「いま」になるように、未来の2倍
  futureWindowMs: 60_000, // 仮
  resultTopN: 7,
  nameMaxUnits: 12,

  // データの掃除(functional-design.md「データベースの配置」。仮)
  roundsToKeep: 2,

  // 称号(PRD「未決定事項」。最初の実装で使う仮の条件。functional-design.md「Titles(称号)」)
  titleRules: [
    { id: 'perfectKing', when: (stats) => stats.perfects >= 5 },
    { id: 'hoarder', when: (stats) => stats.totalPoints >= 2000 },
    { id: 'regular', when: (stats) => stats.plays >= 20 },
    { id: 'rookie', when: () => true }, // 最後は、いつも合う
  ],
};
