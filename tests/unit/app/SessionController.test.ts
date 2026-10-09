import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import type { CharacterSpec } from '../../../src/domain/types';
import { StoreError } from '../../../src/infra/store/StoreError';
import { sessionWorld, settle } from '../fixtures/app';
import {
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

const NEXT_ROUND = String(Number(ROUND) + 1);
const CHARACTER: CharacterSpec = {
  hair: 'short',
  shirtColor: 'red',
  accessory: 'none',
};
const SMALL = { ...DEFAULT_CONFIG, roomCapacity: 2 }; // 1部屋2人まで

describe('SessionController: 起動と登録', () => {
  it('初回は登録を待ち、登録したら入室して、いまの回の参加者になる', async () => {
    // Given: プロフィールのない端末
    const w = sessionWorld();
    const d = w.device();
    d.session.start();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
    expect(d.session.uid()).not.toBeNull();

    // When: 登録する
    const verdict = await d.session.register(' ねこ ', CHARACTER);
    await settle();

    // Then
    expect(verdict).toEqual({ ok: true, name: 'ねこ' });
    expect(d.session.profile()).toEqual({ name: 'ねこ', character: CHARACTER });
    expect(d.session.state()).toEqual({
      kind: 'inRoom',
      roomId: 1,
      roundId: ROUND,
      joinedDuring: 'gathering',
    });
    const [player] = w.server.playersOf(1, ROUND);
    expect(player).toMatchObject({ id: d.session.uid(), name: 'ねこ' });
    expect(d.states.map((s) => s.kind)).toEqual([
      'connecting',
      'needsProfile',
      'entering',
      'inRoom',
    ]);
  });

  it('使えない名前なら、保存せずに理由を返す', async () => {
    const w = sessionWorld();
    const d = w.device();
    d.session.start();
    await settle();
    expect(await d.session.register('   ', CHARACTER)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(await d.store.loadProfile(d.session.uid()!)).toBeNull();
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
  });

  it('サインインの前に登録すると、エラー', async () => {
    const d = sessionWorld().device();
    await expect(d.session.register('ねこ', CHARACTER)).rejects.toThrow(
      'サインインの前'
    );
  });

  it('2回目以降は、すぐ入室する。実績も読む', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    expect(me.session.state().kind).toBe('inRoom');
    expect(me.session.stats()).toMatchObject({ plays: 0 });
  });

  it('実績の読み込みに失敗しても、続ける(実績は null)', async () => {
    const w = sessionWorld();
    const d = w.device();
    vi.spyOn(d.store, 'loadStats').mockRejectedValue(new Error('壊れた'));
    d.session.start();
    await settle();
    expect(d.session.stats()).toBeNull();
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
  });

  it('start は2回呼んでもよい', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    me.session.start();
    await settle();
    expect(w.server.playersOf(1, ROUND)).toHaveLength(1);
  });
});

describe('SessionController: 自分の画面', () => {
  it('updateProfile: 名前とキャラを変える。入室はし直さない', async () => {
    const w = sessionWorld();
    const me = await w.registered('a');
    const states = me.states.length;
    const other: CharacterSpec = { ...CHARACTER, hair: 'bun' };

    expect(await me.session.updateProfile('  ', other)).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(me.session.profile()!.name).toBe('a');

    expect(await me.session.updateProfile('b', other)).toEqual({
      ok: true,
      name: 'b',
    });
    expect(me.session.profile()).toEqual({ name: 'b', character: other });
    expect(await me.store.loadProfile(me.uid)).toEqual({
      name: 'b',
      character: other,
    });
    expect(me.states).toHaveLength(states);
  });

  it('updateProfile: サインインの前はエラー', async () => {
    const d = sessionWorld().device();
    await expect(d.session.updateProfile('b', CHARACTER)).rejects.toThrow(
      'サインインの前'
    );
  });

  it('refreshStats: 自分の実績を読み直す。読めなければ null で、前の値は残す', async () => {
    const w = sessionWorld();
    expect(await w.device().session.refreshStats()).toBeNull(); // サインインの前

    const me = await w.registered();
    w.server.applyStats(me.uid, me.uid, 'r1', {
      plays: 1,
      successes: 1,
      perfects: 0,
      totalPoints: 30,
    });
    expect(await me.session.refreshStats()).toMatchObject({ totalPoints: 30 });
    expect(me.session.stats()).toMatchObject({ totalPoints: 30 });

    vi.spyOn(me.store, 'loadStats').mockRejectedValueOnce(
      new StoreError('offline', '切れた')
    );
    expect(await me.session.refreshStats()).toBeNull();
    expect(me.session.stats()).toMatchObject({ totalPoints: 30 });
  });
});

describe('SessionController: 入室と待機', () => {
  it('集合中は空いた部屋に入り、全部満員なら部屋を作る', async () => {
    const w = sessionWorld(START, SMALL);
    const rooms = [];
    for (const name of ['a', 'b', 'c']) {
      const d = await w.registered(name);
      rooms.push(d.session.state());
    }
    expect(rooms.map((s) => s.kind === 'inRoom' && s.roomId)).toEqual([
      1, 1, 2,
    ]);
  });

  it('ゲーム中に入ると、途中参加(joinedDuring = playing)になる', async () => {
    const w = sessionWorld();
    await w.registered('a'); // 部屋を作っておく(ゲーム中は、部屋を作らない)
    w.clock.advance(PLAY_START + 10_000 - START);
    const me = await w.registered('b');
    expect(me.session.state()).toMatchObject({
      kind: 'inRoom',
      joinedDuring: 'playing',
    });
  });

  it('ゲーム中に満員なら待機し、次の回の集合で入る', async () => {
    const w = sessionWorld(START, SMALL);
    await w.registered('a');
    await w.registered('b');
    w.clock.advance(PLAY_START - START);

    const late = await w.registered('c');
    expect(late.session.state()).toEqual({
      kind: 'waiting',
      reason: 'full',
      until: NEXT_START,
    });

    w.clock.advance(NEXT_START - PLAY_START);
    await settle();
    expect(late.session.state()).toMatchObject({
      kind: 'inRoom',
      roomId: 2,
      roundId: NEXT_ROUND,
    });
  });

  it.each([
    ['終了の1分前以降', PLAY_END - 60_000],
    ['結果発表中', PLAY_END + 1_000],
  ])('%sは待機し、次の回の集合で入る', async (_label, at) => {
    const w = sessionWorld(at);
    const me = await w.registered();
    expect(me.session.state()).toEqual({
      kind: 'waiting',
      reason: 'lastMinute',
      until: NEXT_START,
    });
    w.clock.advance(NEXT_START - at);
    await settle();
    expect(me.session.state()).toMatchObject({
      kind: 'inRoom',
      roundId: NEXT_ROUND,
      joinedDuring: 'gathering',
    });
  });

  it('部屋の取り合いに負けたら、その部屋を満員として決め直す', async () => {
    const w = sessionWorld(START, SMALL);
    await w.registered('a');
    await w.registered('b');
    const d = w.device();
    vi.spyOn(d.store, 'readRoomCounts').mockResolvedValue([0]); // 古い人数を見た
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, { name: 'c', character: CHARACTER });
    d.session.start();
    await settle();
    expect(d.session.state()).toMatchObject({ kind: 'inRoom', roomId: 2 });
  });

  it('回が変わったら、同じ部屋で、次の回の参加者になる', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    w.clock.advance(NEXT_START - START);
    await settle();
    expect(me.session.state()).toEqual({
      kind: 'inRoom',
      roomId: 1,
      roundId: NEXT_ROUND,
      joinedDuring: 'gathering',
    });
    expect(w.server.playersOf(1, NEXT_ROUND).map((p) => p.id)).toEqual([
      me.uid,
    ]);
    expect(w.server.rejections).toEqual([]);
  });

  it('入室の途中で切れたら(StoreError)、retryMs 後にやり直す。それ以外の例外は onError', async () => {
    const w = sessionWorld();
    const d = w.device();
    const read = vi
      .spyOn(d.store, 'readRoomCounts')
      .mockRejectedValueOnce(new StoreError('offline', '切れた'));
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, { name: 'a', character: CHARACTER });
    d.session.start();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'entering' });
    expect(w.onError).not.toHaveBeenCalled();

    read.mockRejectedValueOnce(new Error('想定外'));
    w.clock.advance(DEFAULT_CONFIG.retryMs);
    await settle();
    expect(w.onError).toHaveBeenCalledTimes(1);
    expect(d.session.state()).toEqual({ kind: 'entering' }); // 想定外は、やり直さない
  });

  it('参加者の追加に失敗(StoreError)したら、入室中のまま。想定外の例外は onError', async () => {
    const w = sessionWorld();
    const d = w.device();
    const add = vi
      .spyOn(d.store, 'addPlayer')
      .mockRejectedValueOnce(new StoreError('offline', '切れた'))
      .mockRejectedValueOnce(new Error('想定外'));
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, { name: 'a', character: CHARACTER });
    d.session.start();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'entering' });
    expect(w.onError).not.toHaveBeenCalled();

    w.clock.advance(NEXT_START - START); // 次の回で、もう一度
    await settle();
    expect(w.onError).toHaveBeenCalledTimes(1);
    const humans = add.mock.calls.filter(([, , p]) => p.kind === 'human');
    expect(humans).toHaveLength(2);
  });
});
