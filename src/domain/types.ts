/**
 * ドメイン全体で使う型(docs/functional-design.md「データモデル定義」)。
 *
 * 複数の分野が使う型を置く。ほかの型(Profile・RoundView など)は、
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

/** AIの性格。表示名(「がめついAI」など)は、言語ごとの文言の一覧に持つ */
export type AiPersonality =
  'greedy' | 'balancer' | 'perfectionist' | 'moody' | 'lastSpurt';

// キャラクターの部品の種類は、PRDの未決定事項。決まったら、値を絞る
export type HairId = string;
export type ShirtColorId = string;
export type AccessoryId = string;

/** 人間の小人の見た目 */
export interface CharacterSpec {
  readonly hair: HairId;
  readonly shirtColor: ShirtColorId;
  readonly accessory: AccessoryId;
}

/** 名前とキャラクター(docs/functional-design.md「エンティティ: Profile」) */
export interface Profile {
  readonly name: string; // ニックネーム。validateName を通したもの
  readonly character: CharacterSpec;
}

/** 回の参加者(docs/functional-design.md「エンティティ: Player」) */
export interface Player {
  readonly id: string; // 回の中で一意。人間は uid、AIは 'ai-1' など
  readonly kind: 'human' | 'ai';
  readonly uid: string | null; // 人間だけ
  readonly name: string; // 人間は Profile の名前。AIは空でもよい
  readonly character: CharacterSpec | null; // 人間だけ
  readonly personality: AiPersonality | null; // AIだけ
  readonly joinedAt: number; // サーバー時刻。入った順(小人の並び順)に使う
  readonly joinedDuring: 'gathering' | 'playing'; // 召喚の演出を出すかの判断に使う
}
/** 合図。プレイヤーごとの、最新の押し方の強さ(docs/functional-design.md「エンティティ: Round」) */
export interface Pulse {
  readonly t: number; // サーバー時刻
  readonly power: number; // 直近の押し方の強さ(0〜3)。他の人が書いた値なので、使う側で検証する
}
