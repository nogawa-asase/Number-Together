import type { Unsubscribe } from '../store/GameStore';
import type { ServerClock } from '../store/ServerClock';

/**
 * 端末の時計を、そのまま使う ServerClock(ローカルモード用。サーバーとの差の補正はない)。
 * Firebase につなぐときは、サーバー時刻との差で補正する実装を使う。
 */
export class SystemClock implements ServerClock {
  now(): number {
    return Date.now();
  }

  onOffsetChange(): Unsubscribe {
    return () => {}; // 差は変わらない
  }
}
