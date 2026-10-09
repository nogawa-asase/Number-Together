/**
 * 1秒あたりに押す回数から、1回の tick(dtMs)で押す確率を求める。
 *
 * tick が短ければ、確率は perSec × dtMs / 1000。1を超えるときは1にする
 * (tick より速くは押せない)。dtMs が0以下なら、押さない。
 *
 * @param perSec - 1秒あたりに押す回数(0以上)
 * @param dtMs - 前の tick からの時間
 */
export function pressChance(perSec: number, dtMs: number): number {
  if (dtMs <= 0 || perSec <= 0) {
    return 0;
  }
  return Math.min(1, (perSec * dtMs) / 1_000);
}
