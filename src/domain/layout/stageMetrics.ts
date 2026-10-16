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
  readonly bodyHeightPx: number; // 1人分の小人の高さ(「あなた」の吹き出しの位置)
  readonly jumpFreshMs: number; // この時間より新しい合図だけ、跳ねる
  readonly hopHeightPx: number; // 1回の跳ねる高さ(だれでも同じ)
  readonly hopDurationMs: number; // 1回の跳ねる時間(だれでも同じ)
  /** power 1・2・3 のとき、跳ねる動きを最初からやり直す間隔。hopDurationMs より短いと、途中で切られてピクピク動く */
  readonly hopIntervalsMs: readonly [number, number, number];
}

/** 舞台の寸法の既定 */
export const DEFAULT_STAGE_METRICS: StageMetrics = {
  bodyWidthPx: 22, // 1人分の SVG の幅(docs/design/screens/README.md)
  edgePx: 6.2, // 見本(20人・幅308px)の両端
  maxPitchPx: 28, // 体の幅 + 6px(仮)
  backBottomPx: 22,
  frontBottomPx: 15,
  bodyHeightPx: 32,
  jumpFreshMs: 1_500, // functional-design.md「10. 小人の舞台」
  hopHeightPx: 20, // 自分の小人が押したときと同じ
  hopDurationMs: 600,
  // power は直近1秒に押した回数(1〜2回・3〜5回・6回以上)なので、おおよそ押す間隔に合わせる(仮)。
  // power 1 は最後まで跳ね、2・3 は途中で切られる(実機で試して、自分の連打のピクピクが面白かったため)
  hopIntervalsMs: [700, 250, 140],
};
