import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { currentRoundId, waitFor } from '../support/testCycle';
import { rulesEnv } from './env';

/**
 * 回の中のデータ(players・pulses・points)と、古い回の削除(docs/architecture.md「ルールのテスト」)。
 * どれも、いまの回の段階で決まるので、段階ごとにまとめて確かめる
 */
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
  // alice が AI担当で、部屋にいる
  await seed('rooms/1/aiHost', 'alice');
  await seed('rooms/1/presence/alice', { joinedAt: 1 });
});

const as = (uid: string) => env.authenticatedContext(uid).database();
const seed = (path: string, value: unknown) =>
  env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path).set(value));
const at = (round: string, rest: string) => `rooms/1/rounds/${round}/${rest}`;

function human(uid: string) {
  return {
    id: uid,
    kind: 'human',
    uid,
    name: uid,
    character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    joinedAt: NOW,
    joinedDuring: 'gathering',
  };
}

function ai(id: string, personality = 'greedy') {
  return {
    id,
    kind: 'ai',
    name: '',
    personality,
    joinedAt: NOW,
    joinedDuring: 'gathering',
  };
}

describe('players: 参加者', () => {
  it('人間は、自分だけを追加できる。書き換え・削除はできない', async () => {
    await waitFor('playing', 2_000);
    const round = currentRoundId();
    await assertSucceeds(
      as('bob').ref(at(round, 'players/bob')).set(human('bob'))
    );
    await assertFails(
      as('bob').ref(at(round, 'players/carol')).set(human('carol'))
    );
    await assertFails(
      as('bob')
        .ref(at(round, 'players/bob'))
        .set({ ...human('bob'), name: 'x' })
    );
    await assertFails(as('bob').ref(at(round, 'players/bob')).remove());
  });

  it('AIは、AI担当だけが追加できる。性格は決めた中から', async () => {
    await waitFor('playing', 2_000);
    const round = currentRoundId();
    await assertFails(as('bob').ref(at(round, 'players/ai-1')).set(ai('ai-1')));
    await assertSucceeds(
      as('alice').ref(at(round, 'players/ai-1')).set(ai('ai-1'))
    );
    await assertFails(
      as('alice').ref(at(round, 'players/ai-2')).set(ai('ai-2', 'boss'))
    );
  });

  it('いまの回ではない回、サーバー時刻ではない joinedAt、決めていない項目は書けない', async () => {
    await waitFor('playing', 2_000);
    const index = Number(currentRoundId());
    const round = String(index);
    await assertFails(
      as('bob')
        .ref(at(String(index + 1), 'players/bob'))
        .set(human('bob'))
    );
    await assertFails(
      as('bob')
        .ref(at(round, 'players/bob'))
        .set({ ...human('bob'), joinedAt: 1 })
    );
    await assertFails(
      as('bob')
        .ref(at(round, 'players/bob'))
        .set({ ...human('bob'), extra: 1 })
    );
  });
});

describe('pulses: 合図', () => {
  it('ゲーム中は、自分の分だけ書ける。AIの分はAI担当だけ。power は 0〜3 の整数', async () => {
    await waitFor('playing', 2_000);
    const round = currentRoundId();
    await seed(at(round, 'players/ai-1'), { ...ai('ai-1'), joinedAt: 1 });
    await assertSucceeds(
      as('bob').ref(at(round, 'pulses/bob')).set({ t: NOW, power: 2 })
    );
    await assertFails(
      as('bob').ref(at(round, 'pulses/carol')).set({ t: NOW, power: 2 })
    );
    await assertFails(
      as('bob').ref(at(round, 'pulses/ai-1')).set({ t: NOW, power: 2 })
    );
    await assertSucceeds(
      as('alice').ref(at(round, 'pulses/ai-1')).set({ t: NOW, power: 3 })
    );
    await assertFails(
      as('bob').ref(at(round, 'pulses/bob')).set({ t: NOW, power: 4 })
    );
    await assertFails(
      as('bob').ref(at(round, 'pulses/bob')).set({ t: NOW, power: 1.5 })
    );
    await assertFails(
      as('bob').ref(at(round, 'pulses/bob')).set({ t: 1, power: 1 })
    );
  });

  it('集合中は書けない', async () => {
    await waitFor('gathering', 1_000);
    await assertFails(
      as('bob')
        .ref(at(currentRoundId(), 'pulses/bob'))
        .set({ t: NOW, power: 1 })
    );
  });
});

describe('points: ポイント', () => {
  it('ゲーム中: 自分の分を書けて、減らせない。AIの分はAI担当だけ。他の人は読めない', async () => {
    await waitFor('playing', 2_500);
    const round = currentRoundId();
    await seed(at(round, 'players/ai-1'), { ...ai('ai-1'), joinedAt: 1 });
    await assertSucceeds(as('bob').ref(at(round, 'points/bob')).set(10));
    await assertFails(as('bob').ref(at(round, 'points/bob')).set(9));
    await assertFails(as('bob').ref(at(round, 'points/bob')).set(10.5));
    await assertFails(as('bob').ref(at(round, 'points/carol')).set(10));
    await assertFails(as('bob').ref(at(round, 'points/ai-1')).set(10));
    await assertSucceeds(as('alice').ref(at(round, 'points/ai-1')).set(10));
    await assertSucceeds(as('bob').ref(at(round, 'points/bob')).once('value'));
    await assertFails(as('carol').ref(at(round, 'points/bob')).once('value'));
  });

  it('終了の猶予の間は、まだ書けて、他の人は読めない。猶予のあとは、書けず、誰でも読める', async () => {
    await waitFor('grace', 300);
    const round = currentRoundId();
    await assertSucceeds(as('bob').ref(at(round, 'points/bob')).set(5));
    await assertFails(as('carol').ref(at(round, 'points/bob')).once('value'));
    await waitFor('result', 1_000);
    await assertFails(as('bob').ref(at(round, 'points/bob')).set(6));
    await assertSucceeds(
      as('carol').ref(at(round, 'points/bob')).once('value')
    );
  });

  it('集合中は書けない。終わった回のポイントは、誰でも読める', async () => {
    await waitFor('gathering', 1_000);
    const index = Number(currentRoundId());
    await assertFails(
      as('bob')
        .ref(at(String(index), 'points/bob'))
        .set(1)
    );
    await seed(at(String(index - 1), 'points/bob'), 7);
    await assertSucceeds(
      as('carol')
        .ref(at(String(index - 1), 'points/bob'))
        .once('value')
    );
  });
});

describe('rounds: 古い回の削除', () => {
  it('AI担当は、終わった回を消せる。いまの回は消せない。担当でない人は消せない', async () => {
    await waitFor('playing', 2_000);
    const index = Number(currentRoundId());
    const old = String(index - 2);
    await seed(at(old, 'number'), 5);
    await seed(at(String(index), 'number'), 5);
    await assertFails(as('bob').ref(`rooms/1/rounds/${old}`).remove());
    await assertSucceeds(as('alice').ref(`rooms/1/rounds/${old}`).remove());
    await assertFails(as('alice').ref(`rooms/1/rounds/${index}`).remove());
  });

  it('担当が部屋を出ても、担当の値が自分のままなら、消せる(担当の値で決める)', async () => {
    await waitFor('playing', 2_000);
    const old = String(Number(currentRoundId()) - 2);
    await seed(at(old, 'number'), 5);
    await seed('rooms/1/presence/alice', null);
    await assertSucceeds(as('alice').ref(`rooms/1/rounds/${old}`).remove());
  });
});
