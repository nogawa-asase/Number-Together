import { html, text } from './dom';

/**
 * 通信量の計測の結果を、画面の右下に小さく出す(テストプレイ用。VITE_TRAFFIC_METER=1 のときだけ)。
 * 計測のための表示で、利用者向けではないので、文言の一覧には入れない
 */
export function createTrafficBadge(): {
  element: HTMLElement;
  show(summary: string): void;
} {
  const element = html('<div class="traffic-badge" hidden></div>');
  return {
    element,
    show(summary) {
      element.hidden = false;
      text(element, summary);
    },
  };
}
