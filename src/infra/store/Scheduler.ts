/** タイマーを止める関数 */
export type Cancel = () => void;

/**
 * タイマー。アプリケーション層は、setTimeout・setInterval を直接使わず、これを通す
 * (テストとシミュレーションで、本物の時間を待たずに進めるため)。
 */
export interface Scheduler {
  /** ms 後に1回呼ぶ */
  after(ms: number, callback: () => void): Cancel;
  /** ms ごとに呼ぶ */
  every(ms: number, callback: () => void): Cancel;
}
