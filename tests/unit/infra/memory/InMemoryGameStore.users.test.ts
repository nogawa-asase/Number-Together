import { describe, expect, it } from 'vitest';
import { InMemoryGameStore } from '../../../../src/infra/memory/InMemoryGameStore';
import type { HairId, Profile } from '../../../../src/domain/types';
import { StoreError } from '../../../../src/infra/store/StoreError';
import { memoryWorld } from '../../fixtures/memoryStore';

const PROFILE: Profile = {
  name: 'ゆうき',
  character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
};
const SUCCESS = {
  plays: 1,
  successes: 1,
  perfects: 0,
  totalPoints: 120,
} as const;

describe('InMemoryGameStore: 利用者・プロフィール・実績', () => {
  it('利用者ごとに、違う uid が付く。同じ窓口のサインインは、同じ uid', async () => {
    const world = memoryWorld();
    const a = await world.connect();
    const b = await world.connect();
    expect(a.uid).not.toBe(b.uid);
    expect(await a.store.signIn()).toEqual({ uid: a.uid });
  });

  it('サインインの前に使うと、StoreError(notSignedIn)', async () => {
    const store = new InMemoryGameStore(memoryWorld().server);
    await expect(store.loadStats('x')).rejects.toMatchObject({
      kind: 'notSignedIn',
    });
    await expect(store.loadStats('x')).rejects.toBeInstanceOf(StoreError);
  });

  it('プロフィールを保存し、ほかの人も読める', async () => {
    const world = memoryWorld();
    const a = await world.connect();
    const b = await world.connect();
    expect(await b.store.loadProfile(a.uid)).toBeNull();

    await a.store.saveProfile(a.uid, PROFILE);

    expect(await b.store.loadProfile(a.uid)).toEqual(PROFILE);
  });

  it('他の人のプロフィールは、書けない(拒否は例外にせず、記録に残る)', async () => {
    const world = memoryWorld();
    const a = await world.connect();
    const b = await world.connect();

    await b.store.saveProfile(a.uid, PROFILE);

    expect(await a.store.loadProfile(a.uid)).toBeNull();
    expect(world.server.rejections).toEqual([
      { uid: b.uid, action: 'saveProfile', reason: '本人だけ' },
    ]);
  });

  it.each([
    ['空の名前', { ...PROFILE, name: '' }],
    ['13文字の名前', { ...PROFILE, name: 'abcdefghijklm' }],
    [
      '21文字の部品',
      {
        ...PROFILE,
        character: { ...PROFILE.character, hair: 'x'.repeat(21) as HairId },
      },
    ],
  ])('%s は、保存できない', async (_label, profile) => {
    const world = memoryWorld();
    const a = await world.connect();
    await a.store.saveProfile(a.uid, profile);
    expect(await a.store.loadProfile(a.uid)).toBeNull();
  });

  it('実績は、はじめは0', async () => {
    const a = await memoryWorld().connect();
    expect(await a.store.loadStats(a.uid)).toEqual({
      plays: 0,
      successes: 0,
      perfects: 0,
      totalPoints: 0,
      lastCountedRound: null,
    });
  });

  it('実績を足す。同じ回は、二重に数えない', async () => {
    const a = await memoryWorld().connect();
    await a.store.applyStats(a.uid, '10', SUCCESS);
    await a.store.applyStats(a.uid, '10', SUCCESS);
    await a.store.applyStats(a.uid, '11', { ...SUCCESS, totalPoints: 30 });

    expect(await a.store.loadStats(a.uid)).toEqual({
      plays: 2,
      successes: 2,
      perfects: 0,
      totalPoints: 150,
      lastCountedRound: '11',
    });
  });

  it('他の人の実績は、書けない', async () => {
    const world = memoryWorld();
    const a = await world.connect();
    const b = await world.connect();
    await b.store.applyStats(a.uid, '10', SUCCESS);
    expect((await a.store.loadStats(a.uid)).plays).toBe(0);
  });

  it('実績が負になる変化は、拒否する', async () => {
    const world = memoryWorld();
    const a = await world.connect();
    await a.store.applyStats(a.uid, '10', { ...SUCCESS, totalPoints: -1 });
    expect((await a.store.loadStats(a.uid)).plays).toBe(0);
    expect(world.server.rejections[0]?.reason).toBe('実績は0以上の整数');
  });
});
