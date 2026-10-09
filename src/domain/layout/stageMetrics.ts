/**
 * 小人の舞台の寸法(docs/design/screens/screens/05-play.html の見本の値)。
 *
 * 見た目の寸法なので、遊びの設定(GameConfig)とは分けて持つ。
 * 舞台の幅は、画面の幅で変わるので、ここには持たず、引数で受け取る。
 */
export interface StageMetrics {
  readonly bodyWidthPx: number; // 1人分の小人の幅
  readonly edgePx: number; // 舞台の端から、最初・最後の小人まで(人数が多いとき)
  readonly maxPitchPx: number; // 人数が少ないときの間隔の上限(重ならない)
  readonly backBottomPx: number; // 奥(偶数番目)の小人の、舞台の下からの高さ
  readonly frontBottomPx: number; // 手前(奇数番目)の小人の、舞台の下からの高さ
  readonly jumpFreshMs: number; // この時間より新しい合図だけ、跳ねる
  readonly jumpHeightsPx: readonly [number, number, number]; // power 1・2・3 の跳ねる高さ
  readonly jumpDurationsMs: readonly [number, number, number]; // power 1・2・3 の1回の跳ねる時間
}

/** 舞台の寸法の既定 */
export const DEFAULT_STAGE_METRICS: StageMetrics = {
  bodyWidthPx: 22, // 1人分の SVG の幅(docs/design/screens/README.md)
  edgePx: 6.2, // 見本(20人・幅308px)の両端
  maxPitchPx: 28, // 体の幅 + 6px(仮)
  backBottomPx: 22,
  frontBottomPx: 15,
  jumpFreshMs: 1_500, // functional-design.md「10. 小人の舞台」
  jumpHeightsPx: [14, 20, 26], // 最大26px(仮。見本は 12〜26px)
  jumpDurationsMs: [900, 700, 500], // 強いほど速い(仮。見本は 0.45〜1秒)
};
