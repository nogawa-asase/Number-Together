import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { rulesEnv } from './env';

let env: RulesTestEnvironment;
const PROFILE = {
  name: 'たろう',
  character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
};
const STATS = {
  plays: 1,
  successes: 1,
  perfects: 0,
  totalPoints: 10,
  lastCountedRound: '123',
};

beforeAll(async () => {
  env = await rulesEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const as = (uid: string) => env.authenticatedContext(uid).database();

describe('users: プロフィール', () => {
  it('自分のプロフィールは書ける。他人のは書けない', async () => {
    await assertSucceeds(as('alice').ref('users/alice/profile').set(PROFILE));
    await assertFails(as('bob').ref('users/alice/profile').set(PROFILE));
  });

  it('ログインしていれば、他人のプロフィールも読める。ログインしていなければ読めない', async () => {
    await assertSucceeds(as('bob').ref('users/alice/profile').once('value'));
    await assertFails(
      env
        .unauthenticatedContext()
        .database()
        .ref('users/alice/profile')
        .once('value')
    );
  });

  it.each([
    ['空の名前', { ...PROFILE, name: '' }],
    ['13文字の名前', { ...PROFILE, name: 'abcdefghijklm' }],
    [
      '21文字の部品',
      { ...PROFILE, character: { ...PROFILE.character, hair: 'x'.repeat(21) } },
    ],
    ['部品が足りない', { ...PROFILE, character: { hair: 'short' } }],
    ['決めていない項目', { ...PROFILE, extra: 1 }],
  ])('%s は書けない', async (_label, profile) => {
    await assertFails(as('alice').ref('users/alice/profile').set(profile));
  });
});

describe('users: 実績', () => {
  it('自分の実績は書ける。他人のは書けない', async () => {
    await assertSucceeds(as('alice').ref('users/alice/stats').set(STATS));
    await assertFails(as('bob').ref('users/alice/stats').set(STATS));
  });

  it.each([
    ['負の数', { ...STATS, plays: -1 }],
    ['小数', { ...STATS, totalPoints: 1.5 }],
    ['文字列', { ...STATS, perfects: '1' }],
    ['足りない項目', { plays: 1 }],
    ['決めていない項目', { ...STATS, extra: 1 }],
  ])('%s は書けない', async (_label, stats) => {
    await assertFails(as('alice').ref('users/alice/stats').set(stats));
  });
});
