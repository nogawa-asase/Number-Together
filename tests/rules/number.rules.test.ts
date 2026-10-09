import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { currentRoundId, waitFor } from '../support/testCycle';
import { rulesEnv } from './env';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await rulesEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearDatabase();
});

const inc = (n: number) => ({ '.sv': { increment: n } });
const numberRef = (uid: string, round: string) =>
  env
    .authenticatedContext(uid)
    .database()
    .ref(`rooms/1/rounds/${round}/number`);

describe('number: 共有の数字', () => {
  it('ゲーム中は、いまの回に ±50 まで加算できる(ルールの中の "" + 数値 が、回の id と一致する)', async () => {
    await waitFor('playing', 2_000);
    const round = currentRoundId();
    await assertSucceeds(numberRef('alice', round).set(inc(50)));
    await assertSucceeds(numberRef('bob', round).set(inc(-50)));
    await assertFails(numberRef('alice', round).set(inc(51)));
    await assertFails(numberRef('alice', round).set(inc(-51)));
    await assertFails(numberRef('alice', round).set(inc(0.5)));
  });

  it('いまの回ではない回(前の回・次の回)には書けない', async () => {
    await waitFor('playing', 2_000);
    const index = Number(currentRoundId());
    await assertFails(numberRef('alice', String(index - 1)).set(inc(1)));
    await assertFails(numberRef('alice', String(index + 1)).set(inc(1)));
  });

  it('集合中は、加算できない', async () => {
    await waitFor('gathering', 1_000);
    await assertFails(numberRef('alice', currentRoundId()).set(inc(1)));
  });

  it('終了の後(猶予・結果発表)は、加算できない', async () => {
    await waitFor('grace', 300);
    await assertFails(numberRef('alice', currentRoundId()).set(inc(1)));
    await waitFor('result', 1_000);
    await assertFails(numberRef('alice', currentRoundId()).set(inc(1)));
  });

  it('ログインしていれば読める', async () => {
    await assertSucceeds(numberRef('alice', currentRoundId()).once('value'));
  });
});
