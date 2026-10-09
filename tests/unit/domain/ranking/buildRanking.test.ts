import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { buildRanking } from '../../../../src/domain/ranking/buildRanking';
import { aiOf, humanOf } from '../../fixtures/players';

/** 一覧の行を、[id, 順位, ポイント] にして比べやすくする */
function summary(
  rows: readonly { rank: number; points: number; player: { id: string } }[]
) {
  return rows.map((row) => [row.player.id, row.rank, row.points]);
}

describe('buildRanking', () => {
  it('ポイントの多い順に並べる', () => {
    const players = [humanOf('a'), humanOf('b'), humanOf('c')];
    const view = buildRanking(
      players,
      { a: 10, b: 30, c: 20 },
      'a',
      DEFAULT_CONFIG
    );

    expect(summary(view.top)).toEqual([
      ['b', 1, 30],
      ['c', 2, 20],
      ['a', 3, 10],
    ]);
    expect(view.top.map((row) => row.isMe)).toEqual([false, false, true]);
    expect(view.me).toBeNull();
  });

  describe('同点', () => {
    it('同点は同じ順位で、次の順位は飛ぶ(1, 1, 3)', () => {
      const players = [humanOf('a'), humanOf('b'), humanOf('c')];
      const view = buildRanking(
        players,
        { a: 30, b: 30, c: 10 },
        null,
        DEFAULT_CONFIG
      );
      expect(view.top.map((row) => row.rank)).toEqual([1, 1, 3]);
    });

    it('同点の並びは、入った順、次に id の順(配列の順に左右されない)', () => {
      const players = [
        humanOf('z', { joinedAt: 100 }),
        humanOf('y', { joinedAt: 50 }),
        humanOf('x', { joinedAt: 50 }),
      ];
      const view = buildRanking(
        players,
        { x: 5, y: 5, z: 5 },
        null,
        DEFAULT_CONFIG
      );
      expect(view.top.map((row) => row.player.id)).toEqual(['x', 'y', 'z']);
    });
  });

  describe('上位7人と、自分の行', () => {
    // p1 が 100、p2 が 90 … p10 が 10
    const players = Array.from({ length: 10 }, (_, i) => humanOf(`p${i + 1}`));
    const points = Object.fromEntries(
      players.map((player, i) => [player.id, 100 - i * 10])
    );

    it('上位7人を出す', () => {
      const view = buildRanking(players, points, null, DEFAULT_CONFIG);
      expect(view.top.map((row) => row.player.id)).toEqual([
        'p1',
        'p2',
        'p3',
        'p4',
        'p5',
        'p6',
        'p7',
      ]);
    });

    it('自分が7位なら、上位に入り、me は null', () => {
      const view = buildRanking(players, points, 'p7', DEFAULT_CONFIG);
      expect(view.top[6]?.isMe).toBe(true);
      expect(view.me).toBeNull();
    });

    it('自分が8位なら、me に自分の行が入る', () => {
      const view = buildRanking(players, points, 'p8', DEFAULT_CONFIG);
      expect(view.me).toMatchObject({ rank: 8, points: 30, isMe: true });
      expect(view.me?.player.id).toBe('p8');
    });

    it('見ているだけ(myId が null)なら、me は null', () => {
      expect(buildRanking(players, points, null, DEFAULT_CONFIG).me).toBeNull();
    });

    it('自分が参加者にいなければ、me は null', () => {
      expect(
        buildRanking(players, points, 'someone', DEFAULT_CONFIG).me
      ).toBeNull();
    });

    it('同点が7位をまたいでも、行数は7で切る', () => {
      const tied = Array.from({ length: 9 }, (_, i) => humanOf(`t${i}`));
      const view = buildRanking(
        tied,
        Object.fromEntries(tied.map((player) => [player.id, 5])),
        't8',
        DEFAULT_CONFIG
      );
      expect(view.top).toHaveLength(7);
      expect(view.me).toMatchObject({ rank: 1, isMe: true });
    });

    it('出す人数は、設定で変えられる', () => {
      const config = { ...DEFAULT_CONFIG, resultTopN: 3 };
      expect(buildRanking(players, points, null, config).top).toHaveLength(3);
    });
  });

  it('AIも一覧に入る', () => {
    const players = [humanOf('me'), aiOf('ai-1'), aiOf('ai-2')];
    const view = buildRanking(
      players,
      { me: 10, 'ai-1': 50, 'ai-2': 20 },
      'me',
      DEFAULT_CONFIG
    );
    expect(summary(view.top)).toEqual([
      ['ai-1', 1, 50],
      ['ai-2', 2, 20],
      ['me', 3, 10],
    ]);
  });

  it('参加者が0人なら、空の一覧', () => {
    expect(buildRanking([], {}, 'me', DEFAULT_CONFIG)).toEqual({
      top: [],
      me: null,
    });
  });

  it('ポイントがない、または壊れた値なら、0として並べる', () => {
    const players = [
      'ok',
      'missing',
      'text',
      'negative',
      'fraction',
      'nan',
    ].map((id) => humanOf(id));
    const view = buildRanking(
      players,
      { ok: 1, text: '999', negative: -5, fraction: 2.5, nan: Number.NaN },
      null,
      DEFAULT_CONFIG
    );
    expect(view.top[0]?.player.id).toBe('ok');
    expect(view.top.slice(1).map((row) => [row.rank, row.points])).toEqual([
      [2, 0],
      [2, 0],
      [2, 0],
      [2, 0],
      [2, 0],
    ]);
  });

  it('入力の配列を書き換えない', () => {
    const players = [humanOf('a'), humanOf('b')];
    buildRanking(players, { a: 1, b: 2 }, null, DEFAULT_CONFIG);
    expect(players.map((player) => player.id)).toEqual(['a', 'b']);
  });
});
