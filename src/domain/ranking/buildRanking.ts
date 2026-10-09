import type { GameConfig } from '../config/types';
import type { Player } from '../types';
import type { RankingView, RankRow } from './types';

/**
 * 他の人が書いたポイントを、信用せずに読む。0以上の整数でなければ(なし・壊れた値)、0として扱う
 */
function safePoints(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

/**
 * id を、コードの単位の順で比べる(localeCompare は、端末の言語で結果が変わるので使わない)
 */
function compareIds(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

/**
 * 結果発表の一覧を作る(docs/functional-design.md「5. 結果発表の一覧」)。
 *
 * - ポイントの多い順。同点は、入った順(joinedAt)、次に id の順に並べる(どの端末でも同じ並びにする)
 * - 同点は同じ順位で、次の順位は飛ぶ(1, 1, 3)
 * - 上位 resultTopN 行を出す。同点が境目をまたいでも、行数で切る
 * - 自分が上位にいなければ、自分の行を me に入れる
 * - AIも一覧に入れる
 *
 * @param players - 回の参加者
 * @param points - プレイヤーごとのポイント(他の人が書いた値なので、壊れていてもよい)
 * @param myId - 自分の Player.id。見ているだけなら null
 * @param config - 設定値(resultTopN を使う)
 */
export function buildRanking(
  players: readonly Player[],
  points: Readonly<Record<string, unknown>>,
  myId: string | null,
  config: GameConfig
): RankingView {
  const sorted = players
    .map((player) => ({ player, points: safePoints(points[player.id]) }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        a.player.joinedAt - b.player.joinedAt ||
        compareIds(a.player.id, b.player.id)
    );

  const rows: RankRow[] = [];
  for (const [index, entry] of sorted.entries()) {
    const previous = rows[index - 1];
    rows.push({
      rank:
        previous !== undefined && previous.points === entry.points
          ? previous.rank
          : index + 1,
      player: entry.player,
      points: entry.points,
      isMe: entry.player.id === myId,
    });
  }

  const top = rows.slice(0, config.resultTopN);
  const myRow = rows.find((row) => row.isMe);
  const me = myRow !== undefined && !top.includes(myRow) ? myRow : null;
  return { top, me };
}
