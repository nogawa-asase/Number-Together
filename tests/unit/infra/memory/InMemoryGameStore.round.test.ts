import { describe, expect, it } from 'vitest';
import {
  GRACE_END,
  memoryWorld,
  NEXT_START,
  PLAY_END,
  PLAY_START,
  ROUND,
  START,
} from '../../fixtures/memoryStore';
import { aiOf, humanOf } from '../../fixtures/players';

/** 部屋に人間2人(a は AI担当)。集合中の始まりから */
async function setup() {
  const world = memoryWorld(START);
  const a = await world.connect();
  const b = await world.connect();
  const roomId = await a.store.createRoom(a.uid);
  await b.store.tryEnterRoom(roomId, b.uid, 20);
  await a.store.claimAiHost(roomId, ROUND, a.uid);
  return { world, a, b, roomId };
}

describe('InMemoryGameStore: 参加者', () => {
  it('人間は自分を、AI担当はAIを追加できる。joinedAt はサーバー時刻', async () => {
    const { world, a, b, roomId } = await setup();
    world.clock.set(START + 5_000);

    await b.store.addPlayer(roomId, ROUND, humanOf(b.uid, { joinedAt: 1 }));
    await a.store.addPlayer(roomId, ROUND, aiOf('ai-1'));

    expect(world.server.playersOf(roomId, ROUND)).toMatchObject([
      { id: b.uid, joinedAt: START + 5_000 },
      { id: 'ai-1', joinedAt: START + 5_000 },
    ]);
  });

  it('他の人や、AI担当でない人のAIは、追加できない', async () => {
    const { world, a, b, roomId } = await setup();
    await b.store.addPlayer(roomId, ROUND, humanOf(a.uid));
    await b.store.addPlayer(roomId, ROUND, aiOf('ai-1'));
    await b.store.addPlayer(roomId, ROUND, humanOf(b.uid, { uid: a.uid }));
    expect(world.server.playersOf(roomId, ROUND)).toEqual([]);
    expect(world.server.rejections).toHaveLength(3);
  });

  it('決めた性格でないAIは、追加できない', async () => {
    const { world, a, roomId } = await setup();
    await a.store.addPlayer(roomId, ROUND, aiOf('ai-1', { personality: null }));
    expect(world.server.playersOf(roomId, ROUND)).toEqual([]);
  });

  it('13文字以上の名前は、追加できない', async () => {
    const { world, b, roomId } = await setup();
    await b.store.addPlayer(
      roomId,
      ROUND,
      humanOf(b.uid, { name: 'x'.repeat(13) })
    );
    expect(world.server.playersOf(roomId, ROUND)).toEqual([]);
  });

  it('追加だけ。同じ id は、書き換えられない', async () => {
    const { world, b, roomId } = await setup();
    await b.store.addPlayer(roomId, ROUND, humanOf(b.uid, { name: 'one' }));
    await b.store.addPlayer(roomId, ROUND, humanOf(b.uid, { name: 'two' }));
    expect(world.server.playersOf(roomId, ROUND)).toMatchObject([
      { name: 'one' },
    ]);
  });

  it('いまの回でない回には、追加できない', async () => {
    const { world, b, roomId } = await setup();
    await b.store.addPlayer(roomId, '4928210', humanOf(b.uid));
    expect(world.server.playersOf(roomId, '4928210')).toEqual([]);
    await b.store.addPlayer(99, ROUND, humanOf(b.uid)); // ない部屋
    expect(world.server.rejections).toHaveLength(2);
  });

  it('購読すると、今の一覧と、増えるたびの一覧が届く', async () => {
    const { a, b, roomId } = await setup();
    const seen: string[][] = [];
    a.store.onPlayers(roomId, ROUND, (players) =>
      seen.push(players.map((p) => p.id))
    );
    await b.store.addPlayer(roomId, ROUND, humanOf(b.uid));
    expect(seen).toEqual([[], [b.uid]]);
  });
});

describe('InMemoryGameStore: 数字', () => {
  it('ゲーム中は、サーバー側で足す', async () => {
    const { world, a, b, roomId } = await setup();
    world.clock.set(PLAY_START);
    const seen: number[] = [];
    a.store.onNumber(roomId, ROUND, (n) => seen.push(n));

    await a.store.addToNumber(roomId, ROUND, 5);
    await b.store.addToNumber(roomId, ROUND, -2);

    expect(seen).toEqual([0, 5, 3]);
  });

  it.each([
    ['ゲーム開始の1ミリ秒前', PLAY_START - 1, false],
    ['ゲーム開始ちょうど', PLAY_START, true],
    ['ゲーム終了の1ミリ秒前', PLAY_END - 1, true],
    ['ゲーム終了ちょうど', PLAY_END, false],
  ])('%s に足せるか: %s', async (_label, at, accepted) => {
    const { world, a, roomId } = await setup();
    world.clock.set(at);
    await a.store.addToNumber(roomId, ROUND, 1);
    expect(world.server.numberOf(roomId, ROUND)).toBe(accepted ? 1 : 0);
  });

  it.each([
    [50, 50],
    [-50, -50],
    [51, 0],
    [-51, 0],
    [1.5, 0],
  ])('1回に %s を足すと、%i', async (delta, expected) => {
    const { world, a, roomId } = await setup();
    world.clock.set(PLAY_START);
    await a.store.addToNumber(roomId, ROUND, delta);
    expect(world.server.numberOf(roomId, ROUND)).toBe(expected);
  });

  it('いまの回でない回には、足せない', async () => {
    const { world, a, roomId } = await setup();
    world.clock.set(PLAY_START);
    await a.store.addToNumber(roomId, '4928210', 1);
    expect(world.server.numberOf(roomId, '4928210')).toBe(0);
  });
});

describe('InMemoryGameStore: 合図', () => {
  it('ゲーム中に、自分の合図を送れる。t はサーバー時刻', async () => {
    const { world, b, roomId } = await setup();
    world.clock.set(PLAY_START + 100);
    const seen: unknown[] = [];
    b.store.onPulses(roomId, ROUND, (pulses) => seen.push(pulses));

    await b.store.sendPulse(roomId, ROUND, b.uid, 2);

    expect(seen).toEqual([{}, { [b.uid]: { t: PLAY_START + 100, power: 2 } }]);
  });

  it('AI担当は、AIの合図を送れる。ほかの人は送れない', async () => {
    const { world, a, b, roomId } = await setup();
    await a.store.addPlayer(roomId, ROUND, aiOf('ai-1'));
    world.clock.set(PLAY_START);

    await b.store.sendPulse(roomId, ROUND, 'ai-1', 1);
    await b.store.sendPulse(roomId, ROUND, a.uid, 1);
    expect(world.server.pulsesOf(roomId, ROUND)).toEqual({});

    await a.store.sendPulse(roomId, ROUND, 'ai-1', 3);
    expect(Object.keys(world.server.pulsesOf(roomId, ROUND))).toEqual(['ai-1']);
  });

  it('AI担当でも、AIでない人の合図は送れない', async () => {
    const { world, a, b, roomId } = await setup();
    await b.store.addPlayer(roomId, ROUND, humanOf(b.uid));
    world.clock.set(PLAY_START);
    await a.store.sendPulse(roomId, ROUND, b.uid, 1);
    expect(world.server.pulsesOf(roomId, ROUND)).toEqual({});
  });

  it.each([-1, 4, 1.5])('power %s は送れない', async (power) => {
    const { world, b, roomId } = await setup();
    world.clock.set(PLAY_START);
    await b.store.sendPulse(roomId, ROUND, b.uid, power);
    expect(world.server.pulsesOf(roomId, ROUND)).toEqual({});
  });

  it('ゲーム中でなければ、送れない', async () => {
    const { world, b, roomId } = await setup();
    world.clock.set(PLAY_END);
    await b.store.sendPulse(roomId, ROUND, b.uid, 1);
    expect(world.server.pulsesOf(roomId, ROUND)).toEqual({});
  });
});

describe('InMemoryGameStore: ポイント', () => {
  it.each([
    ['ゲーム開始の1ミリ秒前', PLAY_START - 1, false],
    ['ゲーム開始ちょうど', PLAY_START, true],
    ['終了の3秒後の1ミリ秒前', GRACE_END - 1, true],
    ['終了の3秒後ちょうど', GRACE_END, false],
  ])('%s に書けるか: %s', async (_label, at, accepted) => {
    const { world, b, roomId } = await setup();
    world.clock.set(at);
    await b.store.writePoints(roomId, ROUND, b.uid, 10);
    expect(await b.store.readPoints(roomId, ROUND)).toEqual(
      accepted ? { [b.uid]: 10 } : {}
    );
  });

  it('減らない。0以上の整数だけ', async () => {
    const { world, b, roomId } = await setup();
    world.clock.set(PLAY_START);
    await b.store.writePoints(roomId, ROUND, b.uid, 10);
    await b.store.writePoints(roomId, ROUND, b.uid, 9);
    await b.store.writePoints(roomId, ROUND, b.uid, 10.5);
    await b.store.writePoints(roomId, ROUND, b.uid, 10); // 同じ値は書ける
    expect(await b.store.readPoints(roomId, ROUND)).toEqual({ [b.uid]: 10 });
    expect(world.server.rejections).toHaveLength(2);
  });

  it('他の人の分は書けない。AI担当は、AIの分を書ける', async () => {
    const { world, a, b, roomId } = await setup();
    await a.store.addPlayer(roomId, ROUND, aiOf('ai-1'));
    world.clock.set(PLAY_START);
    await b.store.writePoints(roomId, ROUND, a.uid, 5);
    await b.store.writePoints(roomId, ROUND, 'ai-1', 5);
    await a.store.writePoints(roomId, ROUND, 'ai-1', 7);
    world.clock.set(GRACE_END);
    expect(await b.store.readPoints(roomId, ROUND)).toEqual({ 'ai-1': 7 });
  });

  it('他の人の分は、終了の3秒後から読める。自分の分は、いつでも', async () => {
    const { world, a, b, roomId } = await setup();
    world.clock.set(PLAY_START);
    await a.store.writePoints(roomId, ROUND, a.uid, 3);
    await b.store.writePoints(roomId, ROUND, b.uid, 8);

    world.clock.set(GRACE_END - 1);
    expect(await b.store.readPoints(roomId, ROUND)).toEqual({ [b.uid]: 8 });

    world.clock.set(GRACE_END);
    expect(await b.store.readPoints(roomId, ROUND)).toEqual({
      [a.uid]: 3,
      [b.uid]: 8,
    });
  });

  it('終わった回の分は、いつでも読める', async () => {
    const { world, a, b, roomId } = await setup();
    world.clock.set(PLAY_START);
    await a.store.writePoints(roomId, ROUND, a.uid, 3);
    world.clock.set(NEXT_START + 40_000); // 次の回のゲーム中
    expect(await b.store.readPoints(roomId, ROUND)).toEqual({ [a.uid]: 3 });
  });
});

describe('InMemoryGameStore: 古い回の削除', () => {
  it('AI担当は、いまの回でない回を消せる', async () => {
    const { world, a, b, roomId } = await setup();
    world.clock.set(PLAY_START);
    await a.store.addToNumber(roomId, ROUND, 7);
    world.clock.set(NEXT_START);
    const seen: number[] = [];
    b.store.onNumber(roomId, ROUND, (n) => seen.push(n));

    await b.store.deleteRound(roomId, ROUND); // 担当でない
    expect(world.server.numberOf(roomId, ROUND)).toBe(7);

    await a.store.deleteRound(roomId, ROUND);
    expect(world.server.numberOf(roomId, ROUND)).toBe(0);
    expect(seen).toEqual([7, 0]);
  });

  it('いまの回は、消せない', async () => {
    const { world, a, roomId } = await setup();
    world.clock.set(PLAY_START);
    await a.store.addToNumber(roomId, ROUND, 7);
    await a.store.deleteRound(roomId, ROUND);
    expect(world.server.numberOf(roomId, ROUND)).toBe(7);
  });
});
