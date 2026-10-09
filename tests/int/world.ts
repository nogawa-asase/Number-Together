import { deleteApp } from 'firebase/app';
import { goOffline } from 'firebase/database';
import { AiHost } from '../../src/app/AiHost';
import { SessionController } from '../../src/app/SessionController';
import { DEFAULT_AI_PARAMS } from '../../src/domain/ai/aiParams';
import { createRandom } from '../../src/domain/ai/random';
import {
  connectFirebase,
  type FirebaseHandles,
} from '../../src/infra/firebase/firebaseApp';
import { FirebaseGameStore } from '../../src/infra/firebase/FirebaseGameStore';
import { FirebaseServerClock } from '../../src/infra/firebase/serverClock';
import { SystemScheduler } from '../../src/infra/timer/SystemScheduler';
import { scaledRules, TEST_CONFIG } from '../support/testCycle';

const PROJECT = 'demo-number-together';
const DATABASE = 'http://127.0.0.1:9000';
const OWNER = { Authorization: 'Bearer owner' };

/** エミュレータにつなぐ設定(.env.example と同じ) */
const SETTINGS = {
  apiKey: 'demo-api-key',
  authDomain: `${PROJECT}.firebaseapp.com`,
  databaseURL: `${DATABASE}/?ns=${PROJECT}`,
  projectId: PROJECT,
  appId: 'demo-app-id',
  useEmulator: true,
};

/** 短い周期のルールを読み込ませ、データベースと利用者を空にする */
export async function resetEmulator(): Promise<void> {
  const rules = await fetch(`${DATABASE}/.settings/rules.json?ns=${PROJECT}`, {
    method: 'PUT',
    headers: OWNER,
    body: scaledRules(),
  });
  if (!rules.ok) {
    throw new Error(`ルールを読み込めません: ${await rules.text()}`);
  }
  await fetch(`${DATABASE}/.json?ns=${PROJECT}`, {
    method: 'DELETE',
    headers: OWNER,
  });
  await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`,
    { method: 'DELETE' }
  );
}

/** 1人分の端末(別々の FirebaseApp で、エミュレータにつなぐ) */
export interface Client {
  readonly fb: FirebaseHandles;
  readonly store: FirebaseGameStore;
  readonly clock: FirebaseServerClock;
  readonly session: SessionController;
  readonly uid: () => string;
  readonly errors: unknown[];
}

let serial = 0;
const clients: Client[] = [];

/**
 * 端末をつなぐ。名前とキャラを保存しておき、SessionController を作る(start はしない)。
 *
 * @param withAi - AI担当のときに、本物の AiHost を動かすか
 */
export async function connectClient(
  name: string,
  withAi = false
): Promise<Client> {
  const fb = connectFirebase(SETTINGS, `client-${(serial += 1)}`);
  const store = new FirebaseGameStore(fb, TEST_CONFIG);
  const clock = new FirebaseServerClock(fb.db);
  const scheduler = new SystemScheduler();
  const errors: unknown[] = [];
  const { uid } = await store.signIn();
  await store.saveProfile(uid, {
    name,
    character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
  });
  const session = new SessionController({
    store,
    clock,
    scheduler,
    config: TEST_CONFIG,
    deviceOnline: () => true,
    createAiHost: (seat) =>
      withAi
        ? new AiHost(
            {
              store,
              clock,
              scheduler,
              config: TEST_CONFIG,
              aiParams: DEFAULT_AI_PARAMS,
              random: createRandom(serial),
              onError: (error) => errors.push(error),
            },
            seat
          )
        : { start: () => {}, stop: () => {} },
    onError: (error) => errors.push(error),
  });
  const client = { fb, store, clock, session, uid: () => uid, errors };
  clients.push(client);
  return client;
}

/** つないだ端末を、すべて片付ける */
export async function disconnectAll(): Promise<void> {
  for (const client of clients.splice(0)) {
    await client.session.stop();
    client.clock.dispose();
    goOffline(client.fb.db);
    await deleteApp(client.fb.app);
  }
}

/** 条件が満たされるまで待つ(timeoutMs を過ぎたら失敗) */
export async function until(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 20_000,
  label = '条件'
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(`${label}が、${timeoutMs}ms 待っても満たされません`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** オーナー(ルールを通さない)で読む */
export async function readAsOwner(path: string): Promise<unknown> {
  const response = await fetch(`${DATABASE}/${path}.json?ns=${PROJECT}`, {
    headers: OWNER,
  });
  return response.json();
}
