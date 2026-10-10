import { describe, expect, it, vi } from 'vitest';
import {
  RoundController,
  type RoundEvent,
  type RoundView,
} from '../../../src/app/RoundController';
import type { SessionState } from '../../../src/app/SessionController';
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
  memoryWorld,
} from '../fixtures/memoryStore';
import { humanOf } from '../fixtures/players';

describe('RoundController: view', () => {
  it('集合中は、人間が足りなくても、AIが加わる前提の人数(5人)で目標を出す', async () => {
    const w = sessionWorld();
    const me = await w.player();
    expect(me.view()).toMatchObject({
      roomId: 1,
      roundId: ROUND,
      number: 0,
      playerCount: 5,
      target: 1_000,
      lower: 900,
      upper: 1_100,
      inRange: false,
      myPoints: 0,
      bonusActive: false,
      result: null,
    });
    expect(me.view()!.clock.phase).toBe('gathering');
    expect(me.view()!.players.map((p) => p.id)).toEqual([me.uid]);
  });

  it('ゲーム中は、参加者の数(AIを含む)で目標を出す。AIは fadeIn で加わる', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START - START);
    await settle();
    const view = me.view()!;
    expect(view.clock.phase).toBe('playing');
    expect(view.playerCount).toBe(5);
    expect(view.players.filter((p) => p.kind === 'ai')).toHaveLength(4);
    expect(me.events.filter((e) => e.kind === 'fadeIn')).toHaveLength(4);
  });

  it('数字の変化で、view とグラフの標本が更新される。窓より前の標本は、最後の1つだけ残る', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_END - 1_000 - START);
    await settle();
    const view = me.view()!;
    expect(view.number).toBe(w.server.numberOf(1, ROUND));
    const windowStart = w.clock.now() - 120_000;
    const before = view.samples.filter((s) => s.t < windowStart);
    expect(before.length).toBeLessThanOrEqual(1);
    expect(view.samples.at(-1)!.value).toBe(view.number);
  });

  it('部屋にいないあいだ(待機中)は、view が null', async () => {
    const w = sessionWorld(PLAY_END + 1_000);
    const me = await w.player();
    expect(me.session.state().kind).toBe('waiting');
    expect(me.view()).toBeNull();
  });

  it('参加者の一覧が届くまでは、view が null(ゲーム中に入ると、目標が0になってしまうため)', async () => {
    // Given: ゲーム中に、自分を参加者に足した。参加者の一覧は、まだ届かない
    const world = memoryWorld(PLAY_START + 1_000);
    const { store, uid } = await world.connect();
    const roomId = await store.createRoom(uid);
    await store.addPlayer(roomId, ROUND, humanOf(uid));
    let deliver = () => {};
    const slowStore = Object.assign(Object.create(store) as typeof store, {
      onPlayers: (
        room: number,
        round: string,
        listener: (players: Player[]) => void
      ) => {
        deliver = () => {
          store.onPlayers(room, round, listener);
        };
        return () => {};
      },
    });
    let emitState = (_state: SessionState) => {};
    const controller = new RoundController(
      {
        store: slowStore,
        clock: world.clock,
        scheduler: world.clock,
        config: DEFAULT_CONFIG,
        onError: vi.fn(),
      },
      {
        onState: (listener) => {
          emitState = listener;
          return () => {};
        },
        uid: () => uid,
      }
    );
    const views: (RoundView | null)[] = [];
    controller.onView((view) => views.push(view));
    controller.start();

    // When: 部屋に入った
    emitState({
      kind: 'inRoom',
      roomId,
      roundId: ROUND,
      joinedDuring: 'playing',
    });
    world.clock.advance(1_000); // 時間で描き直しても
    await settle();

    // Then: 一覧が届くまでは null。届いたら、参加者の数で目標を出す
    expect(views.every((view) => view === null)).toBe(true);
    deliver();
    expect(views.at(-1)).toMatchObject({ playerCount: 1, target: 200 });
    controller.stop();
  });

  it('onView は、登録したときにも、いまの view を1回知らせる。解除のあとは知らせない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    const seen: unknown[] = [];
    const off = me.round.onView((view) => seen.push(view));
    expect(seen).toHaveLength(1);
    off();
    const offEvent = me.round.onEvent((event) => seen.push(event));
    offEvent();
    w.clock.advance(PLAY_START - START);
    expect(seen).toHaveLength(1);
  });
});

describe('RoundController: 合図', () => {
  it('3・2・1(開始の3秒前)・×3タイム・10秒前・終了が、決まった時刻に1回ずつ出る', async () => {
    const w = sessionWorld();
    const me = await w.player();
    const cues: [string, number][] = [];
    me.round.onEvent((event) => {
      if (event.kind === 'cue') {
        cues.push([event.cue, w.clock.now()]);
      }
    });
    w.clock.advance(PLAY_END + 1_000 - START);
    expect(cues).toEqual([
      ['start', PLAY_START - 3_000],
      ['x3', PLAY_END - 60_000],
      ['tenSeconds', PLAY_END - 10_000],
      ['end', PLAY_END],
    ]);
  });
});

describe('RoundController: 押す', () => {
  it('ゲーム中に押すと、数字とポイントがすぐ変わり、送られる', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 1_000 - START);
    const before = me.view()!.number;
    me.round.press('+1');
    expect(me.view()!.number).toBe(before + 1);
    expect(me.view()!.myPoints).toBe(1);
    expect(me.events.at(-1)).toEqual({ kind: 'myPress', press: '+1', gain: 1 });

    me.round.press('-1');
    expect(me.view()!.number).toBe(before);
    expect(me.events.at(-1)).toEqual({ kind: 'myPress', press: '-1', gain: 0 });

    w.clock.advance(200);
    await settle();
    expect(w.server.readPoints(me.uid, 1, ROUND)[me.uid]).toBe(1);
  });

  it('倍増タイム中に範囲の中で+1を押すと、3ポイント', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_END - 30_000 - START);
    // 数字を目標(1,000)にそろえる
    while (w.server.numberOf(1, ROUND) !== 1_000) {
      const gap = 1_000 - w.server.numberOf(1, ROUND);
      await me.store.addToNumber(1, ROUND, Math.max(-50, Math.min(50, gap)));
    }
    me.round.press('+1');
    expect(me.events.at(-1)).toEqual({ kind: 'myPress', press: '+1', gain: 3 });
    expect(me.view()!.bonusActive).toBe(true);
  });

  it('集合中・終了の後・切断中は、受け付けない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    const pressed = () =>
      me.events.filter((e: RoundEvent) => e.kind === 'myPress').length;
    me.round.press('+1'); // 集合中
    w.clock.advance(PLAY_START + 1_000 - START);
    me.store.disconnect();
    me.round.press('+1'); // 切断中
    me.store.reconnect();
    await settle();
    w.clock.advance(PLAY_END - (PLAY_START + 1_000));
    me.round.press('+1'); // 終了ちょうど
    expect(pressed()).toBe(0);
  });

  it('部屋にいないときに押しても、何も起きない', async () => {
    const w = sessionWorld(PLAY_END + 1_000);
    const me = await w.player();
    me.round.press('+1');
    expect(me.events).toEqual([]);
  });
});

describe('RoundController: 参加者の変化', () => {
  it('ゲーム中に人間が加わると、目標の前と後をつけて summon。集合中の人間は演出なし', async () => {
    const w = sessionWorld();
    const me = await w.player('a');
    await w.player('b'); // 集合中
    expect(me.events.filter((e) => e.kind === 'summon')).toEqual([]);

    w.clock.advance(PLAY_START + 10_000 - START);
    await settle();
    const late = await w.player('c');
    const summon = me.events.find((e) => e.kind === 'summon');
    expect(summon).toMatchObject({
      player: { id: late.uid },
      targetFrom: 1_000, // 人間2人 + AI3人
      targetTo: 1_200,
    });
    expect(me.view()!.target).toBe(1_200);
  });
});

describe('RoundController: 回の切り替え', () => {
  it('次の回に移ると、新しい回の view になり、前の回は送らない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(NEXT_START - START);
    await settle();
    expect(me.view()).toMatchObject({
      roundId: String(Number(ROUND) + 1),
      result: null,
      myPoints: 0,
    });
  });

  it('stop のあとは、view が null で、何も知らせない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    me.round.start(); // 2回呼んでもよい
    me.round.stop();
    expect(me.view()).toBeNull();
    const count = me.events.length;
    w.clock.advance(PLAY_END - START);
    expect(me.events).toHaveLength(count);
  });
});

describe('RoundController: 称号', () => {
  it('人間の参加者の実績を読んで、称号を出す。AIには出さない', async () => {
    // Given: ぴったり成功を5回した人と、初めての人
    const w = sessionWorld();
    const veteran = await w.player('a');
    for (let i = 0; i < 5; i++) {
      w.server.applyStats(veteran.uid, veteran.uid, `old-${i}`, {
        plays: 1,
        successes: 1,
        perfects: 1,
        totalPoints: 10,
      });
    }
    const rookie = await w.player('b');

    // When: ゲームが始まり、AIも加わる
    w.clock.advance(PLAY_START - START);
    await settle();

    // Then
    const view = rookie.view()!;
    expect(view.titles).toEqual({
      [veteran.uid]: 'perfectKing',
      [rookie.uid]: 'rookie',
    });
  });

  it('実績を読めなければ(StoreError)、その人の称号は出さない。想定外の例外は onError', async () => {
    const w = sessionWorld();
    const d = w.device();
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name: 'a',
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    vi.spyOn(d.store, 'loadStats')
      .mockResolvedValueOnce({
        plays: 0,
        successes: 0,
        perfects: 0,
        totalPoints: 0,
        lastCountedRound: null,
      }) // セッションの起動
      .mockRejectedValueOnce(new StoreError('offline', '切れた')) // 1回目の回
      .mockRejectedValueOnce(new Error('想定外')); // 次の回
    d.round.start();
    d.session.start();
    await settle();
    expect(d.view()!.titles).toEqual({});
    expect(w.onError).not.toHaveBeenCalled();

    w.clock.advance(NEXT_START - START);
    await settle();
    expect(w.onError).toHaveBeenCalledTimes(1);
  });

  it('実績を読んでいる途中で止めたら、知らせない', async () => {
    const w = sessionWorld();
    const d = w.device();
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name: 'a',
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    let release: () => void = () => {};
    const original = d.store.loadStats.bind(d.store);
    vi.spyOn(d.store, 'loadStats')
      .mockImplementationOnce(original) // セッションの起動
      .mockImplementationOnce(
        (id) =>
          new Promise((resolve) => {
            release = () => void original(id).then(resolve);
          })
      );
    d.round.start();
    d.session.start();
    await settle();
    d.round.stop();
    const count = d.views.length;
    release();
    await settle();
    expect(d.views).toHaveLength(count);
  });
});
