/**
 * AIの手の設定値。押す頻度は、1秒あたりの回数で表す
 * (docs/functional-design.md「AIの手」の、初期値の方針。どれも仮で、シミュレーションで調整する)。
 */
export interface AiParams {
  readonly tickMs: number; // decide を呼ぶ間隔
  readonly reactionDelayMinMs: number; // AIが見る数字の遅れ(最小)
  readonly reactionDelayMaxMs: number; // AIが見る数字の遅れ(最大)

  readonly greedy: {
    readonly plusPerSec: number; // +1の頻度
    readonly bonusPlusPerSec: number; // 倍増タイム中の+1の頻度
    readonly nearUpperMargin: number; // 上端からこの量以内に近づいたら、頻度を下げる
    readonly nearUpperFactor: number; // 上端に近いときの、頻度の倍率
    readonly minusPerSec: number; // −1の頻度
  };
  readonly balancer: {
    readonly correctPerSec: number; // 範囲の外で、戻す方向に押す頻度
    readonly idlePerSec: number; // 範囲の中で、目標の方へ押す頻度
  };
  readonly perfectionist: {
    readonly slowPerSec: number; // 前半に、目標の方へ押す頻度
    readonly finalWindowMs: number; // 残りがこの時間を切ったら、合わせにいく
    readonly finalPerSec: number; // 合わせにいくときの頻度
  };
  readonly moody: {
    readonly pressPerSec: number; // ふだんの頻度(向きは半々)
    readonly burstChance: number; // tick ごとに、連打の頻度になる確率
    readonly burstPerSec: number; // 連打の頻度
  };
  readonly lastSpurt: {
    readonly idlePerSec: number; // 倍増タイムの前の+1の頻度
    readonly spurtPerSec: number; // 倍増タイム中の+1の頻度
    readonly holdBackMargin: number; // 上端からこの量以内なら、押さない
  };
}

/** AIの手の設定値の既定(仮) */
export const DEFAULT_AI_PARAMS: AiParams = {
  tickMs: 250, // functional-design.md「AIの手」の例
  reactionDelayMinMs: 300, // 0.3〜0.8秒前の値を見る
  reactionDelayMaxMs: 800,

  // +1をよく押す(1秒に約2回。倍増タイム中はもっと多く)。上端に近づいても、少し下がる程度
  greedy: {
    plusPerSec: 2,
    bonusPlusPerSec: 4,
    nearUpperMargin: 50,
    nearUpperFactor: 0.7,
    minusPerSec: 0.05, // ほとんど押さない
  },
  // 範囲の外では、戻す方向に1秒に約3回。範囲の中では、1秒に約0.3回
  balancer: { correctPerSec: 3, idlePerSec: 0.3 },
  // 前半はゆっくり。残り20秒を切ったら、1秒に約4回
  perfectionist: { slowPerSec: 0.5, finalWindowMs: 20_000, finalPerSec: 4 },
  // 何もしない・+1・−1を、乱数で選ぶ。たまに連打する
  moody: { pressPerSec: 1, burstChance: 0.1, burstPerSec: 8 },
  // 前半から中盤は、1秒に約0.1回。倍増タイムで一気に
  lastSpurt: { idlePerSec: 0.1, spurtPerSec: 5, holdBackMargin: 20 },
};
