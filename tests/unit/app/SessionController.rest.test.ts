import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import { sessionWorld, settle } from '../fixtures/app';
import {
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../fixtures/memoryStore';

const { hiddenRestMs } = DEFAULT_CONFIG;
const NEXT_ROUND = String(Number(ROUND) + 1);

describe('SessionController: 押さなかった回のあとは、おやすみ', () => {
  it('ゲーム中に一度も押さなかったら、次の回の始めに、部屋を出て接続を切る', async () => {
    // Given: 集合中から部屋にいて、一度も押さない人
    const w = sessionWorld();
    const me = await w.player();
    const goOffline = vi.spyOn(me.store, 'goOffline');

    // When: 次の回の始め
    w.clock.advance(NEXT_START - START);
    await settle();

    // Then: 次の回の参加者にならず、参加中の印も消え、接続を切る
    expect(me.session.state()).toEqual({ kind: 'resting', reason: 'idle' });
    expect(w.server.playersOf(1, NEXT_ROUND)).toEqual([]);
    expect(w.server.presenceOf(1)).not.toHaveProperty(me.uid);
    expect(goOffline).toHaveBeenCalledTimes(1);
    expect(me.view()).toBeNull();
  });

  it('1回でも押せば、次の回も参加する', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_END - 1_000 - START);
    await settle();
    me.round.press('+1');
    w.clock.advance(NEXT_START - (PLAY_END - 1_000));
    await settle();
    expect(me.session.state()).toMatchObject({
      kind: 'inRoom',
      roundId: NEXT_ROUND,
    });
  });

  it('前の回に押していても、その次の回で押さなければ、おやすみ', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START - START);
    me.round.press('+1');
    w.clock.advance(NEXT_START - PLAY_START);
    await settle();
    expect(me.session.state().kind).toBe('inRoom');

    w.clock.advance(NEXT_START - START);
    await settle();
    expect(me.session.state()).toEqual({ kind: 'resting', reason: 'idle' });
  });

  it('「もどる」で、つなぎ直して入室する。集合中なら、その回の参加者になる', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(NEXT_START - START);
    await settle();
    const goOnline = vi.spyOn(me.store, 'goOnline');

    me.session.wake();
    await settle();

    expect(goOnline).toHaveBeenCalledTimes(1);
    expect(me.session.state()).toEqual({
      kind: 'inRoom',
      roomId: 1,
      roundId: NEXT_ROUND,
      joinedDuring: 'gathering',
    });
    expect(w.server.presenceOf(1)).toHaveProperty(me.uid);
  });

  it('おやすみのあいだは、回が変わっても入室しない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(NEXT_START - START);
    await settle();
    w.clock.advance((NEXT_START - START) * 3);
    await settle();
    expect(me.session.state()).toEqual({ kind: 'resting', reason: 'idle' });
    expect(w.server.presenceOf(1)).not.toHaveProperty(me.uid);
  });

  it('待機中の人は、押していなくても、次の回で入室する(部屋にいなかった)', async () => {
    const w = sessionWorld(PLAY_END + 1_000);
    const me = await w.registered();
    expect(me.session.state().kind).toBe('waiting');
    w.clock.advance(NEXT_START - (PLAY_END + 1_000));
    await settle();
    expect(me.session.state()).toMatchObject({
      kind: 'inRoom',
      roundId: NEXT_ROUND,
    });
  });
});

describe('SessionController: 画面が見えないあいだは、おやすみ', () => {
  it('見えないまま hiddenRestMs たったら、部屋を出て接続を切る', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 10_000 - START);
    await settle();

    me.session.setVisible(false);
    w.clock.advance(hiddenRestMs - 1);
    await settle();
    expect(me.session.state().kind).toBe('inRoom');

    w.clock.advance(1);
    await settle();
    expect(me.session.state()).toEqual({ kind: 'resting', reason: 'hidden' });
    expect(w.server.presenceOf(1)).not.toHaveProperty(me.uid);
  });

  it('hiddenRestMs より前に見えたら、何もしない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    me.session.setVisible(false);
    w.clock.advance(hiddenRestMs - 1_000);
    me.session.setVisible(true);
    w.clock.advance(hiddenRestMs * 2);
    await settle();
    expect(me.session.state().kind).toBe('inRoom');
  });

  it('見えたら、自動でつなぎ直し、同じ回の途中なら、同じ部屋の続きから参加する', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 10_000 - START);
    await settle();
    me.session.setVisible(false);
    w.clock.advance(hiddenRestMs);
    await settle();

    me.session.setVisible(true);
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

  it('終了の1分前を過ぎてから戻ったら、次の回を待つ', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(PLAY_START + 10_000 - START);
    await settle();
    me.session.setVisible(false);
    w.clock.advance(PLAY_END - 30_000 - (PLAY_START + 10_000));
    await settle();

    me.session.setVisible(true);
    await settle();

    expect(me.session.state()).toEqual({
      kind: 'waiting',
      reason: 'lastMinute',
      until: NEXT_START,
    });
  });

  it('押さなかったおやすみ(idle)は、画面が見えても、自動では戻らない', async () => {
    const w = sessionWorld();
    const me = await w.player();
    w.clock.advance(NEXT_START - START);
    await settle();
    me.session.setVisible(false);
    me.session.setVisible(true);
    await settle();
    expect(me.session.state()).toEqual({ kind: 'resting', reason: 'idle' });
  });

  it('待機中でも、見えないまま hiddenRestMs たったら、おやすみ。待機のタイマーも止まる', async () => {
    const w = sessionWorld(PLAY_END + 1_000);
    const me = await w.registered();
    me.session.setVisible(false);
    w.clock.advance(hiddenRestMs);
    await settle();
    expect(me.session.state()).toEqual({ kind: 'resting', reason: 'hidden' });
    w.clock.advance(NEXT_START);
    await settle();
    expect(me.session.state().kind).toBe('resting');
  });

  it('初回の登録の前は、見えなくても、おやすみにしない', async () => {
    const w = sessionWorld();
    const d = w.device();
    d.session.start();
    await settle();
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
    d.session.setVisible(false);
    w.clock.advance(hiddenRestMs);
    await settle();
    expect(d.session.state()).toEqual({ kind: 'needsProfile' });
  });
});
