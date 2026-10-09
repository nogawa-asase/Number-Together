import { describe, expect, it } from 'vitest';
import { memoryWorld, START } from '../../fixtures/memoryStore';

describe('InMemoryGameStore: 部屋・参加中の印', () => {
  it('部屋を作ると、作った人が入る', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();

    const roomId = await a.store.createRoom(a.uid);

    expect(roomId).toBe(1);
    expect(await a.store.readRoomCounts()).toEqual([1]);
  });

  it('部屋の番号は、作った順に1から', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    const b = await world.connect();
    expect(await a.store.createRoom(a.uid)).toBe(1);
    expect(await b.store.createRoom(b.uid)).toBe(2);
    expect(await a.store.readRoomCounts()).toEqual([1, 1]);
  });

  it('20人目までは入れ、21人目は入れない(条件付きの書き込み)', async () => {
    const world = memoryWorld(START);
    const owner = await world.connect();
    const roomId = await owner.store.createRoom(owner.uid);
    const results: boolean[] = [];
    for (let i = 0; i < 20; i++) {
      const user = await world.connect();
      results.push(await user.store.tryEnterRoom(roomId, user.uid, 20));
    }
    expect(results.slice(0, 19).every(Boolean)).toBe(true); // 2〜20人目
    expect(results[19]).toBe(false); // 21人目
    expect(await owner.store.readRoomCounts()).toEqual([20]);
  });

  it('呼ぶ側が大きな上限を渡しても、ルールの20人を超えない', async () => {
    const world = memoryWorld(START);
    const owner = await world.connect();
    const roomId = await owner.store.createRoom(owner.uid);
    for (let i = 0; i < 19; i++) {
      const user = await world.connect();
      await user.store.tryEnterRoom(roomId, user.uid, 20);
    }
    const late = await world.connect();
    expect(await late.store.tryEnterRoom(roomId, late.uid, 99)).toBe(false);
  });

  it('同じ人が2回入っても、人数は増えない', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    expect(await a.store.tryEnterRoom(roomId, a.uid, 20)).toBe(true);
    expect(await a.store.readRoomCounts()).toEqual([1]);
  });

  it('ない部屋には入れない', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    expect(await a.store.tryEnterRoom(5, a.uid, 20)).toBe(false);
  });

  it('他の人の印は書けない', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    const b = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    expect(await b.store.tryEnterRoom(roomId, a.uid, 20)).toBe(false);
    await expect(b.store.createRoom(a.uid)).rejects.toMatchObject({
      kind: 'permissionDenied',
    });
  });

  it('参加中の印は、入った時刻(サーバー時刻)を持つ', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    world.clock.advance(1_000);
    const b = await world.connect();
    await b.store.tryEnterRoom(roomId, b.uid, 20);

    const seen: unknown[] = [];
    a.store.onPresence(roomId, (members) => seen.push(members));

    expect(seen).toEqual([
      { [a.uid]: { joinedAt: START }, [b.uid]: { joinedAt: START + 1_000 } },
    ]);
  });

  it('部屋を出ると、印が消え、人数が減る', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    const b = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    await b.store.tryEnterRoom(roomId, b.uid, 20);

    await b.store.leaveRoom(roomId, b.uid);
    await b.store.leaveRoom(roomId, b.uid); // 2回目は何もしない
    await b.store.leaveRoom(roomId, a.uid); // 他の人の分は消せない

    expect(world.server.presenceOf(roomId)).toEqual({
      [a.uid]: { joinedAt: START },
    });
    expect(await a.store.readRoomCounts()).toEqual([1]);
  });

  it('接続が切れると、印が消え、人数が減る(onDisconnect)', async () => {
    const world = memoryWorld(START);
    const a = await world.connect();
    const b = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    await b.store.tryEnterRoom(roomId, b.uid, 20);

    b.store.disconnect();

    expect(Object.keys(world.server.presenceOf(roomId))).toEqual([a.uid]);
    expect(await a.store.readRoomCounts()).toEqual([1]);
  });
});

describe('InMemoryGameStore: AI担当', () => {
  async function roomWithTwo() {
    const world = memoryWorld(START);
    const a = await world.connect();
    const b = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    await b.store.tryEnterRoom(roomId, b.uid, 20);
    return { world, a, b, roomId };
  }

  it('担当が空なら、なれる。ほかの人は、なれない', async () => {
    const { a, b, roomId } = await roomWithTwo();
    expect(await a.store.claimAiHost(roomId, '1', a.uid)).toBe(true);
    expect(await b.store.claimAiHost(roomId, '1', b.uid)).toBe(false);
    expect(await a.store.claimAiHost(roomId, '1', a.uid)).toBe(true); // 自分なら、そのまま
  });

  it('担当が部屋から抜けたら、ほかの人が引き継げる', async () => {
    const { a, b, roomId } = await roomWithTwo();
    await a.store.claimAiHost(roomId, '1', a.uid);
    const seen: (string | null)[] = [];
    b.store.onAiHost(roomId, (uid) => seen.push(uid));

    a.store.disconnect();

    expect(await b.store.claimAiHost(roomId, '1', b.uid)).toBe(true);
    expect(seen).toEqual([a.uid, b.uid]);
  });

  it('他の人の uid では、担当になれない', async () => {
    const { a, b, roomId } = await roomWithTwo();
    expect(await b.store.claimAiHost(roomId, '1', a.uid)).toBe(false);
    expect(await a.store.claimAiHost(roomId, '1', a.uid)).toBe(true);
  });

  it('ない部屋の担当には、なれない', async () => {
    const { a } = await roomWithTwo();
    expect(await a.store.claimAiHost(9, '1', a.uid)).toBe(false);
  });
});
