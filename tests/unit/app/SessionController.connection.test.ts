import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import type { Player } from '../../../src/domain/types';
import { StoreError } from '../../../src/infra/store/StoreError';
import { sessionWorld, settle } from '../fixtures/app';
import {
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

const { initialConnectTimeoutMs, retryMs, offlineScreenDelayMs } =
  DEFAULT_CONFIG;
const NEXT_ROUND = String(Number(ROUND) + 1);
const SMALL = { ...DEFAULT_CONFIG, roomCapacity: 2 };

describe('SessionController: 起動時につながらない', () => {
  it('5秒たってもつながらなければ混雑中。10秒ごとに試し、つながったら進む', async () => {
    // Given: 接続が切れた端末(端末自体はオンライン)
    const w = sessionWorld();
    const d = w.device();
    d.store.disconnect();
    d.session.start();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'connecting' });

    // When/Then: 5秒後に混雑中、その10秒後に1回試す
    w.clock.advance(initialConnectTimeoutMs);
    expect(d.session.state()).toEqual({ kind: 'busy', attempts: 0 });
    const signIn = vi.spyOn(d.store, 'signIn');
    w.clock.advance(retryMs);
    await settle();
    expect(d.session.state()).toEqual({ kind: 'busy', attempts: 1 });
    expect(signIn).toHaveBeenCalledTimes(1);

    // つながったら、進む(自動で試すのは止まる)
    d.store.reconnect();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
    w.clock.advance(retryMs * 3);
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('端末がオフラインなら、混雑中ではなくオフライン。「いますぐ、ためす」で試す', async () => {
    const w = sessionWorld();
    const d = w.device({ deviceOnline: () => false });
    d.store.disconnect();
    d.session.start();
    await settle();
    w.clock.advance(initialConnectTimeoutMs);
    expect(d.session.state()).toEqual({ kind: 'offline', attempts: 0 });

    const signIn = vi.spyOn(d.store, 'signIn');
    d.session.retryNow();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'offline', attempts: 1 });
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('つながったあとの retryNow は、何もしない', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    me.session.retryNow();
    expect(me.session.state().kind).toBe('inRoom');
  });

  it('サインインの想定外の例外は onError に伝える', async () => {
    const w = sessionWorld();
    const d = w.device();
    vi.spyOn(d.store, 'signIn').mockRejectedValue(new Error('想定外'));
    d.session.start();
    await settle();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });
});

describe('SessionController: 部屋にいるあいだに切れた', () => {
  /** ゲーム中に部屋にいる人 */
  async function playing() {
    const w = sessionWorld();
    const me = await w.registered();
    w.clock.advance(PLAY_START + 10_000 - START);
    await settle();
    return { w, me };
  }

  it('3秒後に再接続中。60秒以内につながれば、同じ部屋の続きから参加する', async () => {
    const { w, me } = await playing();
    me.store.disconnect();
    expect(me.session.state().kind).toBe('inRoom'); // すぐには切り替えない
    w.clock.advance(offlineScreenDelayMs);
    expect(me.session.state()).toEqual({
      kind: 'reconnecting',
      roomId: 1,
      attempts: 0,
    });
    w.clock.advance(retryMs);
    expect(me.session.state()).toMatchObject({ attempts: 1 });

    me.store.reconnect();
    await settle();
    expect(me.session.state()).toEqual({
      kind: 'inRoom',
      roomId: 1,
      roundId: ROUND,
      joinedDuring: 'gathering', // 最初に参加したときのまま
    });
    expect(w.server.presenceOf(1)).toHaveProperty(me.uid);
    expect(w.server.rejections).toEqual([]); // 参加者を二重に足していない
  });

  it('60秒を超えてつながったら、待機して、次の回の集合で入室する', async () => {
    const { w, me } = await playing();
    me.store.disconnect();
    w.clock.advance(70_000);
    me.store.reconnect();
    await settle();
    expect(me.session.state()).toEqual({
      kind: 'waiting',
      reason: 'afterOffline',
      until: NEXT_START,
    });

    w.clock.advance(NEXT_START - w.clock.now());
    await settle();
    expect(me.session.state()).toMatchObject({
      kind: 'inRoom',
      roundId: NEXT_ROUND,
    });
  });

  it('60秒以内でも、終了の1分前を過ぎていたら、待機する', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    w.clock.advance(PLAY_END - 70_000 - START);
    me.store.disconnect();
    w.clock.advance(20_000);
    me.store.reconnect();
    await settle();
    expect(me.session.state()).toMatchObject({
      kind: 'waiting',
      reason: 'afterOffline',
    });
  });

  it('60秒を超えても、戻ったのが集合中なら、すぐ入室する', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    const offlineAt = PLAY_END - 60_000;
    w.clock.advance(offlineAt - START);
    me.store.disconnect();
    w.clock.advance(NEXT_START + 15_000 - offlineAt); // 105秒切れていた
    me.store.reconnect();
    await settle();
    expect(me.states.slice(-2).map((s) => s.kind)).toEqual([
      'entering', // 続きからではなく、入室し直す
      'inRoom',
    ]);
    expect(me.session.state()).toMatchObject({ roundId: NEXT_ROUND });
  });

  it('切れている間に部屋が満員になったら、決め直す', async () => {
    const w = sessionWorld(START, SMALL);
    await w.registered('a');
    const b = await w.registered('b');
    w.clock.advance(PLAY_START + 10_000 - START);
    b.store.disconnect();
    await w.registered('c'); // 空いた席に入る
    b.store.reconnect();
    await settle();
    expect(b.session.state()).toMatchObject({
      kind: 'waiting',
      reason: 'full',
    });
  });

  it('戻ったときの入室で、また切れたら(StoreError)、次につながったときに、もう一度', async () => {
    const { w, me } = await playing();
    me.store.disconnect();
    const enter = vi
      .spyOn(me.store, 'tryEnterRoom')
      .mockRejectedValueOnce(new StoreError('offline', '切れた'));
    me.store.reconnect();
    await settle();
    expect(enter).toHaveBeenCalledTimes(1);

    me.store.reconnect(); // もう一度つながった
    await settle();
    expect(me.session.state()).toMatchObject({ kind: 'inRoom', roomId: 1 });
    expect(w.onError).not.toHaveBeenCalled();
  });

  it('参加者を足している間に切れたら、足し終わっても、再接続の画面のまま', async () => {
    const w = sessionWorld();
    const d = w.device();
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name: 'a',
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    let finish: () => void = () => {};
    const original = d.store.addPlayer.bind(d.store);
    vi.spyOn(d.store, 'addPlayer').mockImplementationOnce(
      (room: number, round: string, player: Player) => {
        const written = original(room, round, player); // 書き込みは済み、知らせだけ遅れる
        return new Promise<void>((resolve) => {
          finish = () => void written.then(resolve);
        });
      }
    );
    d.session.start();
    await settle();
    d.store.disconnect();
    w.clock.advance(offlineScreenDelayMs);
    finish();
    await settle();
    expect(d.session.state()).toMatchObject({ kind: 'reconnecting' });
  });
});

describe('SessionController: 部屋の外で', () => {
  it('部屋の外で切れて戻っても、待機のまま', async () => {
    const w = sessionWorld(PLAY_END + 1_000);
    const me = await w.registered();
    me.store.disconnect();
    me.store.reconnect();
    await settle();
    expect(me.session.state()).toMatchObject({ kind: 'waiting' });
  });
});

describe('SessionController: AI担当', () => {
  it('最初の人が担当になり、担当が抜けたら、次に古い人が引き継ぐ', async () => {
    const w = sessionWorld();
    const a = await w.registered('a');
    const b = await w.registered('b');
    expect(w.server.aiHostOf(1)).toBe(a.uid);

    w.clock.advance(PLAY_START + 10_000 - START);
    await a.session.stop();
    await settle();
    expect(w.server.aiHostOf(1)).toBe(b.uid);

    // AIは動き続ける
    const before = w.server.numberOf(1, ROUND);
    w.clock.advance(30_000);
    await settle();
    expect(w.server.numberOf(1, ROUND)).not.toBe(before);
  });

  it('引き継ぐのは、部屋に入った時刻が最も古い人。同じ時刻なら、uid の順', async () => {
    // Given: a・b・c が同じ時刻に、d が1秒後に入る
    const w = sessionWorld();
    const a = await w.registered('a');
    const b = await w.registered('b');
    const c = await w.registered('c');
    w.clock.advance(1_000);
    await w.registered('d');
    expect(w.server.aiHostOf(1)).toBe(a.uid);

    // When/Then: a が抜けると b(c と同じ時刻で、uid が先)、b が抜けると c(d より古い)
    await a.session.stop();
    expect(w.server.aiHostOf(1)).toBe(b.uid);
    await b.session.stop();
    expect(w.server.aiHostOf(1)).toBe(c.uid);
  });

  it('担当を取りにいくときの StoreError は無視し、想定外の例外は onError に伝える', async () => {
    const w = sessionWorld();
    const d = w.device();
    vi.spyOn(d.store, 'claimAiHost')
      .mockRejectedValueOnce(new StoreError('offline', '切れた')) // 部屋に入ったとき
      .mockRejectedValue(new Error('想定外')); // 次の人が入ったとき
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name: 'a',
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    d.session.start();
    await settle();
    expect(w.onError).not.toHaveBeenCalled(); // StoreError は伝えない
    await w.registered('b'); // 参加中の印が変わり、もう一度取りにいく
    expect(w.onError).toHaveBeenCalledTimes(1);
    expect(w.onError).toHaveBeenCalledWith(new Error('想定外'));
  });
});

describe('SessionController: stop', () => {
  it('部屋を出て、すべて止まる。2回呼んでもよい', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    await me.session.stop();
    await me.session.stop();
    expect(w.server.presenceOf(1)).toEqual({});
    const count = me.states.length;
    w.clock.advance(NEXT_START - START);
    await settle();
    expect(me.states).toHaveLength(count);
    expect(w.server.playersOf(1, NEXT_ROUND)).toEqual([]);
  });

  it('サインインの途中で止めたら、その先に進まない', async () => {
    const w = sessionWorld();
    const d = w.device();
    d.session.start();
    await d.session.stop();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'connecting' });
  });

  it('入室の途中で止めたら、入った部屋を出る', async () => {
    const w = sessionWorld();
    const d = w.device();
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name: 'a',
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    let release: () => void = () => {};
    const original = d.store.readRoomCounts.bind(d.store);
    vi.spyOn(d.store, 'readRoomCounts').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve(original());
        })
    );
    d.session.start();
    await settle();
    await d.session.stop();
    release();
    await settle();
    expect(w.server.presenceOf(1)).toEqual({});
    expect(d.session.state()).toEqual({ kind: 'entering' });
  });

  it('止めたあとの登録では、入室しない', async () => {
    const w = sessionWorld();
    const d = w.device();
    d.session.start();
    await settle();
    await d.session.stop();
    await d.session.register('ねこ', {
      hair: 'short',
      shirtColor: 'red',
      accessory: 'none',
    });
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
  });

  it('onState の解除のあとは、知らせない', async () => {
    const w = sessionWorld();
    const d = w.device();
    const seen: string[] = [];
    const unsubscribe = d.session.onState((s) => seen.push(s.kind));
    unsubscribe();
    d.session.start();
    await settle();
    expect(seen).toEqual(['connecting']);
  });

  it('退出の失敗(想定外)は onError に伝える', async () => {
    const w = sessionWorld();
    const me = await w.registered();
    vi.spyOn(me.store, 'leaveRoom').mockRejectedValue(new Error('想定外'));
    await me.session.stop();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });
});
