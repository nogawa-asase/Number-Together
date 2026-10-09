import type { GameConfig } from '../config/types';
import type { JoinVerdict, RoundClock } from './types';

/**
 * いまの回に、途中参加できるかを判断する。
 *
 * 集合中は、いつでも入れる。ゲーム中は、終了の joinCutoffMs(1分)前まで入れる。
 * それ以降と、結果発表中は、次の回の集合まで待つ(PRD「開催の流れ」。終盤に条件が動き続けるのを避けるため)。
 *
 * @param clock - roundClockAt(serverMs) の結果
 * @param serverMs - clock を計算したのと同じサーバー時刻
 * @param config - 設定値(joinCutoffMs を使う)
 */
export function canJoinNow(
  clock: RoundClock,
  serverMs: number,
  config: GameConfig
): JoinVerdict {
  switch (clock.phase) {
    case 'gathering':
      return { ok: true };
    case 'playing':
      return serverMs < clock.playEndsAt - config.joinCutoffMs
        ? { ok: true }
        : { ok: false, reason: 'lastMinute' };
    case 'result':
      return { ok: false, reason: 'lastMinute' };
  }
}
