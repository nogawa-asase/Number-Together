import { describe, expect, it } from 'vitest';
import type { RoundEvent } from '../../../src/app/RoundController';
import { sessionWorld, settle } from '../fixtures/app';
import {
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

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
