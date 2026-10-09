import type { Stats, TitleId } from '../types';

/** 称号の条件。上から順に調べ、最初に合ったものを採用する */
export interface TitleRule {
  readonly id: TitleId;
  readonly when: (stats: Stats) => boolean;
}

/**
 * 設定値。仮の値や、遊びながら調整する値を、すべてここにまとめる
 * (docs/functional-design.md「設定値(GameConfig)」)。
 *
 * 一部の値は、データベースのセキュリティルール(database.rules.json)にも同じ値を書く。
 * 対応は docs/architecture.md「データベースの配置とセキュリティルール」。
 */
export interface GameConfig {
  // 進行
  readonly gatherMs: number; // 集合中の長さ
  readonly playMs: number; // ゲーム中の長さ
  readonly resultMs: number; // 結果発表の長さ
  readonly joinCutoffMs: number; // 終了の何ミリ秒前から途中参加できないか
  readonly pointsGraceMs: number; // 終了のあと、ポイントを書き込める猶予

  // 目標と範囲
  readonly perPlayerTarget: number; // 1人あたりの目標
  readonly rangeRatio: number; // 範囲の割合(目標の±この割合)

  // ポイント
  readonly bonusDurationMs: number; // 倍増タイムの長さ
  readonly bonusMultiplier: number; // 倍増タイム中の倍率
  readonly perfectMultiplier: number; // ぴったり成功の倍率
  readonly pointCap: number | null; // 1回で貯められるポイントの上限。null はなし

  // 部屋とAI
  readonly roomCapacity: number; // 1部屋の最大人数
  readonly aiFillTo: number; // 人間が足りないとき、AIを足して、この人数にそろえる

  // 通信
  readonly batchMs: number; // 連打をまとめて送る間隔
  readonly maxDeltaPerWrite: number; // 1回の送信で、数字を変えられる量の上限(±)
  readonly pulseIntervalMs: number; // 合図を送る間隔(1人につき)
  readonly pulsePowerSteps: readonly [number, number, number]; // 合図の強さ 1・2・3 になる、押した回数
  readonly reconnectGraceMs: number; // 通信が切れてから、続きから参加できる時間
  readonly retryMs: number; // 混雑中・通信切れで、自動で試す間隔
  readonly initialConnectTimeoutMs: number; // 起動時に、この時間つながらなければ、混雑中
  readonly offlineScreenDelayMs: number; // 通信が切れてから、再接続の画面を出すまで

  // 表示
  readonly pastWindowMs: number; // グラフの過去の長さ
  readonly futureWindowMs: number; // グラフの未来の長さ
  readonly resultTopN: number; // 結果発表で出す上位の人数
  readonly nameMaxUnits: number; // 名前の長さの上限(全角を2、半角を1と数える)

  // データの掃除
  readonly roundsToKeep: number; // データベースに残す回の数(いまの回を含む)

  // 称号
  readonly titleRules: readonly TitleRule[];
}
