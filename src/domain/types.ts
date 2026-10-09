/**
 * ドメイン全体で使う型(docs/functional-design.md「データモデル定義」)。
 *
 * いまは、設定値と時計が使う型だけを置く。ほかの型(Player・Profile・RoundView など)は、
 * それを使う分野を作るときに足す。
 */

/** 回の中の段階。集合中・ゲーム中・結果発表 */
export type Phase = 'gathering' | 'playing' | 'result';

/** 実績 */
export interface Stats {
  readonly plays: number; // 参加回数
  readonly successes: number; // 成功回数
  readonly perfects: number; // ぴったり成功の回数
  readonly totalPoints: number; // 累計ポイント
  readonly lastCountedRound: string | null; // 最後に集計した回(同じ回を二重に数えないため)
}

/**
 * 称号。AIの性格「がめつい」('greedy')と取り違えないよう、
 * 称号「欲張り」は 'hoarder' にする(docs/glossary.md「称号」)
 */
export type TitleId = 'rookie' | 'regular' | 'hoarder' | 'perfectKing';

/** 結果。ぴったり成功・成功・失敗(judge が決め、settle が報酬に使う) */
export type Outcome = 'perfect' | 'success' | 'fail';
