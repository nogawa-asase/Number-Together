import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import { judge } from '../../../src/domain/judge/judge';
import { StoreError } from '../../../src/infra/store/StoreError';
import { sessionWorld, settle } from '../fixtures/app';
import {
  GRACE_END,
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

const { retryMs } = DEFAULT_CONFIG;

/** ゲーム中に何回か押してから、終了の直前まで進めた人 */
async function playedUntilEnd() {
  const w = sessionWorld();
  const me = await w.player();
  w.clock.advance(PLAY_START + 1_000 - START);
  for (let i = 0; i < 5; i++) {
    me.round.press('+1');
  }
  w.clock.advance(200);
  await settle();
  w.clock.advance(PLAY_END - 1_000 - w.clock.now());
  await settle();
  return { w, me };
}

describe('RoundController: 結果', () => {
  it('終了の3秒後に、判定・報酬・一覧が出て、実績が1回だけ保存される', async () => {
    const { w, me } = await playedUntilEnd();
    w.clock.advance(GRACE_END - 1 - w.clock.now());
    await settle();
    expect(me.view()!.result).toBeNull();

    w.clock.advance(1);
    await settle();
    const result = me.view()!.result!;
    const final = w.server.numberOf(1, ROUND);
    const verdict = judge(final, 1_000, DEFAULT_CONFIG);
    expect(result).toMatchObject({
      outcome: verdict.outcome,
      missBy: verdict.missBy,
      finalNumber: final,
      target: 1_000,
      myPoints: 5,
      totalBefore: 0, // 初めての回
    });
    expect(result.awarded).toBe(
      verdict.outcome === 'fail' ? 0 : verdict.outcome === 'perfect' ? 10 : 5
    );
    expect(result.ranking.top).toHaveLength(5); // 自分とAI4人
    expect(result.ranking.top.some((row) => row.isMe)).toBe(true);
    const stats = await me.store.loadStats(me.uid);
    expect(stats).toMatchObject({ plays: 1, lastCountedRound: ROUND });
  });

  it('実績の保存に失敗(StoreError)しても、結果は出る。retryMs 後に、もう一度保存する', async () => {
    const { w, me } = await playedUntilEnd();
    const apply = vi
      .spyOn(me.store, 'applyStats')
      .mockRejectedValueOnce(new StoreError('offline', '切れた'));
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    expect(me.view()!.result).not.toBeNull();
    expect(apply).toHaveBeenCalledTimes(1);

    w.clock.advance(retryMs);
    await settle();
    expect(apply).toHaveBeenCalledTimes(2);
    expect(await me.store.loadStats(me.uid)).toMatchObject({ plays: 1 });
    expect(w.onError).not.toHaveBeenCalled();
  });

  it('ポイントを読めなければ(StoreError)、retryMs 後にやり直す。次の回の始めを過ぎるなら、あきらめる', async () => {
    const { w, me } = await playedUntilEnd();
    const read = vi
      .spyOn(me.store, 'readPoints')
      .mockRejectedValue(new StoreError('offline', '切れた'));
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    expect(me.view()!.result).toBeNull();
    w.clock.advance(retryMs);
    await settle();
    w.clock.advance(retryMs);
    await settle();
    // 終了の3秒後・13秒後・23秒後。次の回は、終了の30秒後に始まるので、33秒後には試さない
    expect(read).toHaveBeenCalledTimes(3);
    w.clock.advance(NEXT_START - 1 - w.clock.now());
    await settle();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('想定外の例外は onError に伝え、やり直さない', async () => {
    const { w, me } = await playedUntilEnd();
    vi.spyOn(me.store, 'readPoints').mockRejectedValue(new Error('想定外'));
    w.clock.advance(GRACE_END - w.clock.now() + retryMs);
    await settle();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });

  it('実績の保存の想定外の例外も onError に伝える', async () => {
    const { w, me } = await playedUntilEnd();
    vi.spyOn(me.store, 'applyStats').mockRejectedValue(new Error('想定外'));
    w.clock.advance(GRACE_END - w.clock.now() + retryMs);
    await settle();
    expect(me.view()!.result).not.toBeNull();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });

  it('参加者の一覧にいなければ(見ているだけ)、実績を保存せず、一覧の自分もない', async () => {
    const w = sessionWorld();
    const d = w.device();
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name: 'a',
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    const original = d.store.addPlayer.bind(d.store);
    vi.spyOn(d.store, 'addPlayer').mockImplementation((room, round, player) =>
      player.kind === 'human'
        ? Promise.resolve() // 書いたつもりで、書かれていない
        : original(room, round, player)
    );
    const apply = vi.spyOn(d.store, 'applyStats');
    d.round.start();
    d.session.start();
    await settle();
    w.clock.advance(GRACE_END - START);
    await settle();
    const result = d.view()!.result!;
    expect(result.ranking.top.some((row) => row.isMe)).toBe(false);
    expect(result.ranking.me).toBeNull();
    expect(result.totalBefore).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('RoundController: 結果の累計', () => {
  it('この回をもう数えてあれば(戻ったとき)、報酬を引いた値を、足す前の累計にする', async () => {
    const { w, me } = await playedUntilEnd();
    const awardedOf = () => me.view()!.result!.awarded;
    vi.spyOn(me.store, 'loadStats').mockResolvedValueOnce({
      plays: 3,
      successes: 2,
      perfects: 0,
      totalPoints: 500,
      lastCountedRound: ROUND,
    });
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    expect(me.view()!.result!.totalBefore).toBe(500 - awardedOf());
  });

  it('累計を読めなければ(StoreError)、null にして結果は出す', async () => {
    const { w, me } = await playedUntilEnd();
    vi.spyOn(me.store, 'loadStats').mockRejectedValueOnce(
      new StoreError('offline', '切れた')
    );
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    expect(me.view()!.result!.totalBefore).toBeNull();
    expect(w.onError).not.toHaveBeenCalled();
  });

  it('累計の読み込みの想定外の例外は onError に伝える', async () => {
    const { w, me } = await playedUntilEnd();
    vi.spyOn(me.store, 'loadStats').mockRejectedValueOnce(new Error('想定外'));
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    expect(me.view()!.result!.totalBefore).toBeNull();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });
});

describe('RoundController: statsOf(実績カード)', () => {
  it('参加者の実績を読む。StoreError なら null、想定外の例外は onError に伝えて null', async () => {
    const w = sessionWorld();
    const me = await w.player();
    expect(await me.round.statsOf(me.uid)).toMatchObject({ plays: 0 });

    vi.spyOn(me.store, 'loadStats')
      .mockRejectedValueOnce(new StoreError('offline', '切れた'))
      .mockRejectedValueOnce(new Error('想定外'));
    expect(await me.round.statsOf(me.uid)).toBeNull();
    expect(w.onError).not.toHaveBeenCalled();
    expect(await me.round.statsOf(me.uid)).toBeNull();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });
});

describe('RoundController: 時刻が飛んだとき', () => {
  it('過ぎた合図は出さず、残りの合図は、新しい時刻に合わせて出る', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 10_000 - START);
    const cues: [string, number][] = [];
    me.round.onEvent((event) => {
      if (event.kind === 'cue') {
        cues.push([event.cue, w.clock.now()]);
      }
    });
    w.clock.set(PLAY_END - 30_000); // ×3タイムの時刻を飛び越える
    w.clock.advance(31_000);
    expect(cues).toEqual([
      ['tenSeconds', PLAY_END - 10_000],
      ['end', PLAY_END],
    ]);
  });

  it('結果の時刻を飛び越えたら、すぐ結果を出す', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 10_000 - START);
    w.clock.set(GRACE_END + 5_000);
    await settle();
    expect(me.view()!.result).not.toBeNull();
  });
});

describe('RoundController: 結果を出したあと・出している途中', () => {
  it('結果のあとに時刻が飛んでも、結果を作り直さない', async () => {
    const { w, me } = await playedUntilEnd();
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    const read = vi.spyOn(me.store, 'readPoints');
    w.clock.set(GRACE_END + 5_000);
    await settle();
    expect(read).not.toHaveBeenCalled();
  });

  it('ポイントを読んでいる途中で止めたら、結果を出さない', async () => {
    const { w, me } = await playedUntilEnd();
    let release: () => void = () => {};
    vi.spyOn(me.store, 'readPoints').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({});
        })
    );
    w.clock.advance(GRACE_END - w.clock.now());
    await settle();
    me.round.stop();
    release();
    await settle();
    expect(me.view()).toBeNull();
    expect(w.onError).not.toHaveBeenCalled();
  });
});

describe('RoundController: 途中から戻ったとき', () => {
  it('切れて戻っても、自分のポイントは0に戻らない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 1_000 - START);
    for (let i = 0; i < 3; i++) {
      me.round.press('+1');
    }
    w.clock.advance(200);
    await settle();

    me.store.disconnect();
    w.clock.advance(5_000);
    expect(me.view()).toBeNull(); // 再接続中
    me.store.reconnect();
    await settle();
    expect(me.view()!.myPoints).toBe(3);
  });

  it('戻ったときのポイントの読み込みに失敗しても(想定外)、続ける', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 1_000 - START);
    me.store.disconnect();
    w.clock.advance(5_000);
    vi.spyOn(me.store, 'readPoints').mockRejectedValueOnce(new Error('想定外'));
    me.store.reconnect();
    await settle();
    expect(me.view()!.myPoints).toBe(0);
    expect(w.onError).toHaveBeenCalledTimes(1);
  });
});
