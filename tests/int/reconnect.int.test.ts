import { goOffline, goOnline } from 'firebase/database';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { waitFor } from '../support/testCycle';
import {
  connectClient,
  disconnectAll,
  readAsOwner,
  resetEmulator,
  until,
} from './world';

beforeEach(resetEmulator);
afterEach(disconnectAll);

describe('切断と再接続', () => {
  it('切れると参加中の印が消えて人数が減り、すぐつながれば、同じ部屋の続きから参加する', async () => {
    // Given: a と b が同じ部屋にいる
    const a = await connectClient('a');
    const b = await connectClient('b');
    await waitFor('gathering', 1_500);
    a.session.start();
    await until(() => a.session.state().kind === 'inRoom', 10_000, 'a の入室');
    b.session.start();
    await until(() => b.session.state().kind === 'inRoom', 10_000, 'b の入室');
    const state = b.session.state();
    if (state.kind !== 'inRoom') throw new Error('入室していません');
    const { roomId } = state;

    // When: b が切れる
    goOffline(b.fb.db);
    await until(
      async () =>
        (await readAsOwner(`rooms/${roomId}/presence/${b.uid()}`)) === null,
      10_000,
      'b の印が消える'
    );
    expect(await readAsOwner(`rooms/${roomId}/memberCount`)).toBe(1);

    // When: すぐつながる
    goOnline(b.fb.db);

    // Then: 同じ部屋に戻る
    await until(
      async () =>
        (await readAsOwner(`rooms/${roomId}/presence/${b.uid()}`)) !== null,
      10_000,
      'b の印が戻る'
    );
    expect(b.session.state()).toMatchObject({ kind: 'inRoom', roomId });
    expect(await readAsOwner(`rooms/${roomId}/memberCount`)).toBe(2);
    expect(b.errors).toEqual([]);
  }, 60_000);
});
