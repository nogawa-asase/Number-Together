import { describe, expect, it } from 'vitest';
import { InMemoryGameStore } from '../../../../src/infra/memory/InMemoryGameStore';
import { memoryWorld, PLAY_START, ROUND } from '../../fixtures/memoryStore';

describe('InMemoryGameStore: 購読', () => {
  it('解除したら、届かない', async () => {
    const world = memoryWorld(PLAY_START);
    const a = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    const seen: number[] = [];
    const unsubscribe = a.store.onNumber(roomId, ROUND, (n) => seen.push(n));

    await a.store.addToNumber(roomId, ROUND, 1);
    unsubscribe();
    await a.store.addToNumber(roomId, ROUND, 1);

    expect(seen).toEqual([0, 1]);
  });

  it('ほかの部屋・ほかの回の変化は、届かない', async () => {
    const world = memoryWorld(PLAY_START);
    const a = await world.connect();
    const b = await world.connect();
    const room1 = await a.store.createRoom(a.uid);
    const room2 = await b.store.createRoom(b.uid);
    const seen: number[] = [];
    a.store.onNumber(room1, ROUND, (n) => seen.push(n));

    await b.store.addToNumber(room2, ROUND, 3);

    expect(seen).toEqual([0]);
  });

  it('サインインの前は、購読できない', () => {
    const store = new InMemoryGameStore(memoryWorld().server);
    expect(() => store.onNumber(1, ROUND, () => {})).toThrow(
      expect.objectContaining({ kind: 'notSignedIn' })
    );
  });

  it('ない部屋の購読は、空の値が届く', async () => {
    const a = await memoryWorld().connect();
    const seen: unknown[] = [];
    a.store.onPresence(9, (members) => seen.push(members));
    a.store.onAiHost(9, (uid) => seen.push(uid));
    a.store.onPlayers(9, ROUND, (players) => seen.push(players));
    a.store.onPulses(9, ROUND, (pulses) => seen.push(pulses));
    expect(seen).toEqual([{}, null, [], {}]);
    expect(await a.store.readPoints(9, ROUND)).toEqual({});
  });
});

describe('InMemoryGameStore: 接続', () => {
  it('購読すると今の状態が届き、切れる・つながるたびに届く', async () => {
    const a = await memoryWorld().connect();
    const seen: string[] = [];
    const unsubscribe = a.store.onConnection((state) => seen.push(state));

    a.store.disconnect();
    a.store.reconnect();
    unsubscribe();
    a.store.disconnect();

    expect(seen).toEqual(['online', 'offline', 'online']);
  });

  it('切れている間に購読すると、offline が届く', async () => {
    const a = await memoryWorld().connect();
    a.store.disconnect();
    const seen: string[] = [];
    a.store.onConnection((state) => seen.push(state));
    expect(seen).toEqual(['offline']);
  });

  it('切れている間の書き込みとサインインは、StoreError(offline)', async () => {
    const world = memoryWorld(PLAY_START);
    const a = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    a.store.disconnect();

    await expect(a.store.addToNumber(roomId, ROUND, 1)).rejects.toMatchObject({
      kind: 'offline',
    });
    const fresh = new InMemoryGameStore(world.server);
    fresh.disconnect();
    await expect(fresh.signIn()).rejects.toMatchObject({ kind: 'offline' });
  });

  it('切れている間も、読むことはできる(手元に残っている値)', async () => {
    const a = await memoryWorld().connect();
    a.store.disconnect();
    expect((await a.store.loadStats(a.uid)).plays).toBe(0);
  });

  it('つなぎ直したら、部屋に入り直せる', async () => {
    const world = memoryWorld(PLAY_START);
    const a = await world.connect();
    const b = await world.connect();
    const roomId = await a.store.createRoom(a.uid);
    await b.store.tryEnterRoom(roomId, b.uid, 20);

    b.store.disconnect();
    b.store.reconnect();

    expect(await b.store.tryEnterRoom(roomId, b.uid, 20)).toBe(true);
    expect(await a.store.readRoomCounts()).toEqual([2]);
  });

  it('サインインの前に切れても、印を消そうとしない', () => {
    const store = new InMemoryGameStore(memoryWorld().server);
    expect(() => store.disconnect()).not.toThrow();
  });
});
