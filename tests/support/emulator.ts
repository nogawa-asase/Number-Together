import { scaledRules } from './testCycle';

/** エミュレータの場所(firebase.json・.env.example と同じ) */
export const PROJECT = 'demo-number-together';
export const DATABASE = 'http://127.0.0.1:9000';
const OWNER = { Authorization: 'Bearer owner' };

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

/** オーナー(ルールを通さない)で読む */
export async function readAsOwner(path: string): Promise<unknown> {
  const response = await fetch(`${DATABASE}/${path}.json?ns=${PROJECT}`, {
    headers: OWNER,
  });
  return response.json();
}

/** オーナー(ルールを通さない)で書く(テストの前提を作る) */
export async function writeAsOwner(
  path: string,
  value: unknown
): Promise<void> {
  await fetch(`${DATABASE}/${path}.json?ns=${PROJECT}`, {
    method: 'PUT',
    headers: OWNER,
    body: JSON.stringify(value),
  });
}
