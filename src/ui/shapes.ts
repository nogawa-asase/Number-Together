/** 見本で使う形(SVG の座標の文字列。固定の値) */

/** きらめき(viewBox 0 0 12 12) */
export const SPARKLE_PATH =
  'M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z';

/** トゲトゲの吹き出し(viewBox 0 0 240 170。見本 05 の「いま押すと ×3!!」「目標UP!」。しっぽなし) */
export const SPIKY_BUBBLE =
  '120.0,11.0 136.5,24.7 162.5,12.3 167.2,31.5 192.4,29.6 191.5,44.1 226.3,44.8 206.2,61.0 228.2,69.3 209.2,79.7 227.7,92.5 200.2,97.8 213.8,115.5 180.4,112.8 176.6,127.2 152.4,122.7 141.8,141.7 120.0,126.2 100.0,136.0 87.6,122.7 61.0,129.4 59.6,112.8 26.2,115.5 39.8,97.8 16.6,91.8 30.8,79.7 1.8,68.7 33.8,61.0 22.7,47.3 48.5,44.1 44.5,27.7 72.8,31.5 77.5,12.3 103.5,24.7';

/** トゲトゲの見出し(viewBox 0 0 200 200。見本 07 の「×3 タイム!」、10・11 の結果の見出し) */
export const SPIKY_BURST =
  '100.0,8.0 115.6,31.8 141.9,13.0 143.6,45.3 169.8,44.4 163.0,69.7 195.1,78.3 169.9,100.0 187.9,120.1 163.0,130.3 174.8,159.7 143.6,154.7 137.9,178.7 115.6,168.2 100.0,192.0 84.4,168.2 58.1,187.0 56.4,154.7 30.2,155.6 37.0,130.3 4.9,121.7 30.1,100.0 12.1,79.9 37.0,69.7 25.2,40.3 56.4,45.3 62.1,21.3 84.4,31.8';

/** きらめきの SVG(位置と大きさは style で渡す) */
export function sparkleSvg(
  fill: string,
  style: string,
  className = 'tw'
): string {
  return `<svg class="${className}" viewBox="0 0 12 12" style="${style}"><path d="${SPARKLE_PATH}" fill="${fill}" stroke="#111111" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}

/** チェックの印(範囲内) */
export const CHECK_SVG =
  '<svg viewBox="0 0 24 24" class="check" fill="none" stroke="#111111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 L10 18.5 L20 6"></path></svg>';

/** ×の印(範囲の外・閉じる) */
export const CROSS_SVG =
  '<svg viewBox="0 0 24 24" class="check" fill="none" stroke="#111111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"></path></svg>';
