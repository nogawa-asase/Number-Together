import type { Player } from '../types';

/** 結果発表の一覧の1行 */
export interface RankRow {
  readonly rank: number; // 順位(1から)。同点は同じ順位
  readonly player: Player;
  readonly points: number; // その回で貯めたポイント
  readonly isMe: boolean;
}

/** 結果発表の一覧 */
export interface RankingView {
  readonly top: readonly RankRow[]; // 上位 resultTopN 人
  readonly me: RankRow | null; // 自分が圏外のときだけ入る(「・・・」で区切って下に出す)
}
