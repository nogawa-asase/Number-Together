import type { Unsubscribe } from './GameStore';

/**
 * サーバー時刻(docs/functional-design.md「ServerClock」)。
 *
 * 端末の時計のずれを、サーバー時刻との差で補正した「いまのサーバー時刻」を返す。
 */
export interface ServerClock {
  /** 補正したサーバー時刻(ミリ秒) */
  now(): number;
  /** サーバー時刻との差が変わった(時刻が飛んだ)ときに知らせる */
  onOffsetChange(listener: () => void): Unsubscribe;
}
