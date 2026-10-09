import type { Phase } from '../types';

/** サーバー時刻(ミリ秒)から計算した、いまの回と段階 */
export interface RoundClock {
  readonly roundIndex: number; // 回の番号(0から)
  readonly phase: Phase;
  readonly phaseStartsAt: number; // この段階が始まった時刻
  readonly phaseEndsAt: number; // この段階が終わる時刻
  readonly playStartsAt: number; // ゲーム開始の時刻
  readonly playEndsAt: number; // ゲーム終了の時刻
  readonly bonusStartsAt: number; // 倍増タイムの開始の時刻
  readonly nextRoundStartsAt: number; // 次の回の集合が始まる時刻
}

/** 途中参加できるか */
export type JoinVerdict =
  | { readonly ok: true } // 集合中、または、ゲーム中で終了の1分前より前
  | { readonly ok: false; readonly reason: 'lastMinute' }; // 終了の1分前以降、または、結果発表中
