import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { rulesEnv } from './env';

let env: RulesTestEnvironment;
const NOW = { '.sv': 'timestamp' };

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
const seed = (path: string, value: unknown) =>
  env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path).set(value));

describe('rooms: 部屋の数', () => {
  it('1から始まり、1回に1しか増えない', async () => {
    const db = as('alice');
    await assertFails(db.ref('roomCount').set(0));
    await assertSucceeds(db.ref('roomCount').set(1));
    await assertFails(db.ref('roomCount').set(3));
    await assertSucceeds(db.ref('roomCount').set(2));
  });
});

describe('rooms: 部屋の人数', () => {
  it('0〜20で、1回に1しか増減しない', async () => {
    const db = as('alice');
    await assertSucceeds(db.ref('rooms/1/memberCount').set(1));
    await assertFails(db.ref('rooms/1/memberCount').set(3));
    await assertSucceeds(db.ref('rooms/1/memberCount').set(0));
    await assertFails(db.ref('rooms/1/memberCount').set(-1));
    await seed('rooms/1/memberCount', 20);
    await assertFails(db.ref('rooms/1/memberCount').set(21));
    await assertSucceeds(db.ref('rooms/1/memberCount').set(19));
  });

  it('サーバー側の加算(increment)でも、同じ制約がかかる', async () => {
    const db = as('alice');
    await seed('rooms/1/memberCount', 20);
    await assertFails(
      db.ref('rooms/1/memberCount').set({ '.sv': { increment: 1 } })
    );
    await assertSucceeds(
      db.ref('rooms/1/memberCount').set({ '.sv': { increment: -1 } })
    );
  });
});

describe('rooms: 参加中の印', () => {
  it('自分の印だけ、サーバー時刻で書ける。消せる', async () => {
    await assertSucceeds(
      as('alice').ref('rooms/1/presence/alice').set({ joinedAt: NOW })
    );
    await assertFails(
      as('bob').ref('rooms/1/presence/alice').set({ joinedAt: NOW })
    );
    await assertFails(
      as('bob').ref('rooms/1/presence/bob').set({ joinedAt: 123 })
    );
    await assertSucceeds(as('alice').ref('rooms/1/presence/alice').remove());
  });
});

describe('rooms: AI担当', () => {
  it('空なら、自分の uid を書ける。他人の uid は書けない', async () => {
    await assertFails(as('alice').ref('rooms/1/aiHost').set('bob'));
    await assertSucceeds(as('alice').ref('rooms/1/aiHost').set('alice'));
  });

  it('いまの担当が部屋にいれば、取れない。いなくなれば、取れる', async () => {
    await seed('rooms/1/aiHost', 'alice');
    await seed('rooms/1/presence/alice', { joinedAt: 1 });
    await assertFails(as('bob').ref('rooms/1/aiHost').set('bob'));
    await seed('rooms/1/presence/alice', null);
    await assertSucceeds(as('bob').ref('rooms/1/aiHost').set('bob'));
  });

  it('担当を消すことはできない', async () => {
    await seed('rooms/1/aiHost', 'alice');
    await assertFails(as('alice').ref('rooms/1/aiHost').remove());
  });
});
