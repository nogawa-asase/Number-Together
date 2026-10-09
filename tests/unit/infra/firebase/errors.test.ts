import { describe, expect, it } from 'vitest';
import {
  isNetworkError,
  isPermissionDenied,
  toStoreError,
} from '../../../../src/infra/firebase/errors';
import { StoreError } from '../../../../src/infra/store/StoreError';
import { paths } from '../../../../src/infra/firebase/paths';

describe('Firebase の例外', () => {
  it('拒否は、message か code の PERMISSION_DENIED で分かる', () => {
    expect(
      isPermissionDenied(new Error('PERMISSION_DENIED: Permission denied'))
    ).toBe(true);
    expect(isPermissionDenied({ code: 'permission_denied' })).toBe(true);
    expect(isPermissionDenied(new Error('other'))).toBe(false);
    expect(isPermissionDenied('PERMISSION_DENIED')).toBe(true);
  });

  it('通信できなかったことは、code か message で分かる', () => {
    expect(isNetworkError({ code: 'auth/network-request-failed' })).toBe(true);
    expect(isNetworkError({ code: 'unavailable' })).toBe(true);
    expect(isNetworkError(new Error('Client is offline.'))).toBe(true);
    expect(isNetworkError(new Error('boom'))).toBe(false);
  });

  it('StoreError に変える(種類と、元の例外)', () => {
    const denied = toStoreError(new Error('PERMISSION_DENIED'), '読み込み');
    expect(denied).toBeInstanceOf(StoreError);
    expect(denied.kind).toBe('permissionDenied');
    expect(denied.message).toBe('読み込みに失敗しました');
    expect(toStoreError({ code: 'unavailable' }, 'x').kind).toBe('offline');
    const unknown = new Error('boom');
    expect(toStoreError(unknown, 'x')).toMatchObject({
      kind: 'unknown',
      cause: unknown,
    });
    const already = new StoreError('offline', '切れた');
    expect(toStoreError(already, 'x')).toBe(already);
  });
});

describe('paths', () => {
  it('データベースの配置(docs/functional-design.md)のとおり', () => {
    expect(paths.profile('u')).toBe('users/u/profile');
    expect(paths.stats('u')).toBe('users/u/stats');
    expect(paths.roomCount()).toBe('roomCount');
    expect(paths.memberCount(2)).toBe('rooms/2/memberCount');
    expect(paths.presence(2)).toBe('rooms/2/presence');
    expect(paths.presenceOf(2, 'u')).toBe('rooms/2/presence/u');
    expect(paths.aiHost(2)).toBe('rooms/2/aiHost');
    expect(paths.round(2, '9')).toBe('rooms/2/rounds/9');
    expect(paths.number(2, '9')).toBe('rooms/2/rounds/9/number');
    expect(paths.players(2, '9')).toBe('rooms/2/rounds/9/players');
    expect(paths.player(2, '9', 'u')).toBe('rooms/2/rounds/9/players/u');
    expect(paths.pulses(2, '9')).toBe('rooms/2/rounds/9/pulses');
    expect(paths.pulse(2, '9', 'u')).toBe('rooms/2/rounds/9/pulses/u');
    expect(paths.points(2, '9', 'u')).toBe('rooms/2/rounds/9/points/u');
    expect(paths.connected()).toBe('.info/connected');
    expect(paths.serverTimeOffset()).toBe('.info/serverTimeOffset');
  });
});
