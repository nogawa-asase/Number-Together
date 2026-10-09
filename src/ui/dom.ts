import { type MessageKey, t } from '../app/i18n/i18n';

/**
 * 固定のテンプレート(この中のコードが書いた HTML だけ)から、要素を作る。
 * ユーザー由来の文字列(名前など)は、ここに入れない。あとから text() で入れる
 */
export function html<T extends HTMLElement = HTMLElement>(template: string): T {
  const box = document.createElement('template');
  box.innerHTML = template.trim();
  return box.content.firstElementChild as T;
}

/** data-ref の付いた子要素を取り出す */
export function ref<T extends Element = HTMLElement>(
  root: ParentNode,
  name: string
): T {
  const found = root.querySelector<T>(`[data-ref="${name}"]`);
  if (found === null) {
    throw new Error(`data-ref="${name}" が見つかりません`);
  }
  return found;
}

/** 文字として入れる(HTML として解釈しない) */
export function text(element: Element, value: string): void {
  element.textContent = value;
}

/** data-i18n の付いた要素すべてに、いまの言語の文言を入れる */
export function translate(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n as MessageKey);
  }
}

/** 残り時間を「1:18」の形にする(切り上げ) */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1_000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

/** 画面。DomGameView が、状態に合わせて作り直す */
export interface Screen {
  readonly element: HTMLElement;
  dispose(): void;
}
