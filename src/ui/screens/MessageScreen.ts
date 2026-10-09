import type { MessageKey } from '../../app/i18n/i18n';
import { html, ref, type Screen, translate } from '../dom';

/**
 * 見出しだけの画面(つないでいる途中・想定外のエラー)。
 * ボタンを渡すと、下に出す(エラーのときの「再読み込み」)
 */
export class MessageScreen implements Screen {
  readonly element: HTMLElement;

  constructor(
    title: MessageKey,
    lead: MessageKey | null,
    button: { label: MessageKey; onClick: () => void } | null = null
  ) {
    this.element = html(`
<div class="screen">
  <div class="heading">
    <div class="title" data-i18n="${title}"></div>
    ${lead === null ? '' : `<div class="lead" data-i18n="${lead}"></div>`}
  </div>
  <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
  <div class="spacer"></div>
  ${button === null ? '' : `<button type="button" class="btn btn-big" data-ref="button" data-i18n="${button.label}"></button>`}
</div>`);
    translate(this.element);
    if (button !== null) {
      ref(this.element, 'button').addEventListener('click', button.onClick);
    }
  }

  dispose(): void {}
}
