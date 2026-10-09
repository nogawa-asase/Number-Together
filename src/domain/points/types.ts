import type { RoundClock } from '../schedule/types';

/** 押した操作 */
export type PressKind = '+1' | '-1';

/** pointsForPress の入力 */
export interface PressInput {
  readonly kind: PressKind;
  readonly numberAtPress: number; // 押した瞬間に画面に出ていた数字(サーバーの値 + まだ送っていない自分の分)
  readonly target: number; // 押した瞬間の目標
  readonly nowMs: number; // 押した瞬間のサーバー時刻
  readonly clock: RoundClock; // nowMs から計算した、いまの回
  readonly currentPoints: number; // この回で、いままでに貯めたポイント(上限の判断に使う)
}

/** 結果が出たときの、実績の変化 */
export interface StatsDelta {
  readonly plays: 1;
  readonly successes: 0 | 1;
  readonly perfects: 0 | 1;
  readonly totalPoints: number;
}

/** 結果が出たときの、報酬と実績の変化 */
export interface Settlement {
  readonly awarded: number; // 報酬ポイント
  readonly statsDelta: StatsDelta;
}
