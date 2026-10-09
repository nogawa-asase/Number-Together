import { t } from '../../app/i18n/i18n';
import { html, ref, type Screen, text, translate } from '../dom';

const ICON = `<svg viewBox="0 0 64 64" style="display: block; width: 76px; height: 76px" fill="none" stroke="#111111" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M8 26 Q32 6 56 26"></path><path d="M17 36 Q32 24 47 36"></path><path d="M26 46 Q32 41 38 46"></path>
  <circle cx="32" cy="54" r="2.5" fill="#111111"></circle><path d="M10 8 L54 58" stroke="#FF3B5C" stroke-width="6"></path>
</svg>`;

/** 16 通信が切れたとき */
export class OfflineScreen implements Screen {
  readonly element: HTMLElement;

  constructor(attempts: number, onRetry: () => void) {
    this.element = html(`
<div class="screen">
  <div class="heading">
    <div class="title" data-i18n="offline.title"></div>
    <div class="lead" data-i18n="offline.lead"></div>
  </div>
  <div class="card status-card">
    <div class="offline-icon">${ICON}</div>
    <div class="status-text" data-i18n="offline.reconnecting"></div>
    <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    <div class="note-gray" data-ref="attempt"></div>
  </div>
  <div class="notes">
    <div class="item"><div><span data-i18n="offline.note1"></span><br /><span data-i18n="offline.note1b"></span></div></div>
    <div class="item"><div data-i18n="offline.note2"></div></div>
  </div>
  <div class="spacer"></div>
  <button type="button" class="btn btn-big" data-ref="retry" data-i18n="offline.retry"></button>
</div>`);
    translate(this.element);
    text(
      ref(this.element, 'attempt'),
      t('offline.attempt', { n: attempts + 1 })
    );
    ref(this.element, 'retry').addEventListener('click', onRetry);
  }

  dispose(): void {}
}
