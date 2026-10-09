import { StoreError } from '../store/StoreError';

/** Firebase の例外の code(あれば) */
function codeOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return '';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** ルールに拒否されたか(Realtime Database は、message に PERMISSION_DENIED が入る) */
export function isPermissionDenied(error: unknown): boolean {
  return (
    codeOf(error).toUpperCase().includes('PERMISSION_DENIED') ||
    messageOf(error).toUpperCase().includes('PERMISSION_DENIED')
  );
}

/** 通信できなかったか */
export function isNetworkError(error: unknown): boolean {
  const code = codeOf(error);
  return (
    code === 'auth/network-request-failed' ||
    code === 'unavailable' ||
    /network|offline|disconnect/i.test(messageOf(error))
  );
}

/**
 * Firebase の例外を StoreError に変える(firebase/* の例外を、そのまま上に流さない)。
 *
 * @param error - Firebase の例外
 * @param action - 何をしようとしていたか(メッセージに入れる)
 */
export function toStoreError(error: unknown, action: string): StoreError {
  if (error instanceof StoreError) {
    return error;
  }
  const kind = isPermissionDenied(error)
    ? 'permissionDenied'
    : isNetworkError(error)
      ? 'offline'
      : 'unknown';
  return new StoreError(kind, `${action}に失敗しました`, { cause: error });
}
