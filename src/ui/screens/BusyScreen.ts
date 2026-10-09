import { t } from '../../app/i18n/i18n';
import { html, ref, type Screen, text, translate } from '../dom';

/** 混み合っている様子の小人たち(見本 17 の絵、そのまま) */
const CROWD = [
  `<svg class="jig" viewBox="0 0 22 32" style="left: 8px; bottom: 16px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#3A86FF" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#FFD9B8" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M4 11 Q4 4 11 4 Q18 4 18 11 Q15.5 8 11 8.2 Q6.5 8 4 11 Z" fill="#3B2A20" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></path></svg>`,
  `<svg class="jig jig2" viewBox="0 0 22 32" style="left: 40px; bottom: 24px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#FF9F1C" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#E8B58A" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><polygon points="4,11 3.5,4.5 7,6.5 8,1.5 11,5.2 14,1.5 15,6.5 18.5,4.5 18,11 15,8.2 11,9 7,8.2" fill="#111111" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></polygon></svg>`,
  `<svg class="jig jig3" viewBox="0 0 22 32" style="left: 72px; bottom: 16px"><circle cx="11" cy="10" r="9.5" fill="#111111" stroke="#111111" stroke-width="1.5"></circle><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#9B5DE5" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#C98B5E" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle></svg>`,
  `<svg class="jig" viewBox="0 0 22 32" style="left: 104px; bottom: 24px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#00B8D9" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#E8B58A" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M4 11 Q4 4 11 4 Q18 4 18 11 Q15.5 8 11 8.2 Q6.5 8 4 11 Z" fill="#111111" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></path><circle cx="8.4" cy="12" r="2.3" fill="#FFFFFF" fill-opacity="0.6" stroke="#111111" stroke-width="1.2"></circle><circle cx="13.6" cy="12" r="2.3" fill="#FFFFFF" fill-opacity="0.6" stroke="#111111" stroke-width="1.2"></circle><line x1="10.7" y1="12" x2="11.3" y2="12" stroke="#111111" stroke-width="1.2"></line></svg>`,
  `<svg class="jig jig2" viewBox="0 0 22 32" style="left: 136px; bottom: 16px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#FFC400" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#FFD9B8" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M3.8 10 Q3.8 3.6 11 3.6 Q18.2 3.6 18.2 10 Z" fill="#FF3B5C" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></path><path d="M10 9.6 H20.5 Q21.2 11.4 19.5 11.6 H10 Z" fill="#FF3B5C" stroke="#111111" stroke-width="1.3" stroke-linejoin="round"></path></svg>`,
  `<svg class="jig" viewBox="0 0 22 32" style="left: 168px; bottom: 24px"><circle cx="18.6" cy="15" r="3" fill="#D94F30" stroke="#111111" stroke-width="1.5"></circle><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#FF5C8A" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#FFD9B8" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M4 11 Q4 4 11 4 Q18 4 18 11 Q15.5 8 11 8.2 Q6.5 8 4 11 Z" fill="#D94F30" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></path></svg>`,
  `<svg class="jig jig3" viewBox="0 0 22 32" style="left: 200px; bottom: 16px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#7CB518" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#FFD9B8" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M3.8 9.5 Q3.8 2.8 11 2.8 Q18.2 2.8 18.2 9.5 Z" fill="#3A86FF" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></path><rect x="3.4" y="8" width="15.2" height="3" rx="1.2" fill="#FFFFFF" stroke="#111111" stroke-width="1.3"></rect><circle cx="11" cy="2" r="2" fill="#FFFFFF" stroke="#111111" stroke-width="1.2"></circle></svg>`,
  `<svg class="jig" viewBox="0 0 22 32" style="left: 232px; bottom: 24px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#3A86FF" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#E8B58A" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M8.5 5.5 L8 1 L9.8 3 L11 0.8 L12.2 3 L14 1 L13.5 5.5 Z" fill="#FF5C8A" stroke="#111111" stroke-width="1.2" stroke-linejoin="round"></path></svg>`,
  `<svg class="jig jig2" viewBox="0 0 22 32" style="left: 264px; bottom: 16px"><path d="M4 31 V25.5 Q4 19.5 11 19.5 Q18 19.5 18 25.5 V31 Z" fill="#9B5DE5" stroke="#111111" stroke-width="2" stroke-linejoin="round"></path><circle cx="11" cy="11.5" r="7" fill="#FFD9B8" stroke="#111111" stroke-width="2"></circle><circle cx="8.6" cy="12" r="1" fill="#111111"></circle><circle cx="13.4" cy="12" r="1" fill="#111111"></circle><path d="M4 11 Q4 4 11 4 Q18 4 18 11 Q15.5 8 11 8.2 Q6.5 8 4 11 Z" fill="#E5B800" stroke="#111111" stroke-width="1.5" stroke-linejoin="round"></path></svg>`,
].join('');

/** 17 混雑中 */
export class BusyScreen implements Screen {
  readonly element: HTMLElement;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly startedAt = Date.now();

  /**
   * @param retryMs - 自動で試す間隔(この画面を出したときから数える)
   * @param onRetry - 「いますぐ、ためす」
   */
  constructor(
    private readonly retryMs: number,
    onRetry: () => void
  ) {
    this.element = html(`
<div class="screen">
  <div class="heading">
    <div class="title" data-i18n="busy.title"></div>
    <div class="lead" data-i18n="busy.lead"></div>
  </div>
  <div class="card status-card">
    <div class="busy-stage"><div class="ground"></div>${CROWD}</div>
    <div class="status-text" data-i18n="busy.ask"></div>
    <div class="busy-retry">
      <div class="row">
        <div class="note-gray" data-i18n="busy.auto"></div>
        <div class="time" data-ref="time"></div>
      </div>
      <div class="busy-bar"><div data-ref="bar"></div></div>
    </div>
  </div>
  <div class="spacer"></div>
  <button type="button" class="btn btn-big" data-ref="retry" data-i18n="busy.retry"></button>
</div>`);
    translate(this.element);
    ref(this.element, 'retry').addEventListener('click', onRetry);
    this.tick();
    this.timer = setInterval(() => this.tick(), 250);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  private tick(): void {
    // 試すたびに、状態が変わって作り直されるので、この画面を出してからの時間で数える
    const elapsed = (Date.now() - this.startedAt) % this.retryMs;
    const remaining = this.retryMs - elapsed;
    text(
      ref(this.element, 'time'),
      t('busy.remaining', { s: Math.ceil(remaining / 1_000) })
    );
    ref(this.element, 'bar').style.width =
      `${(remaining / this.retryMs) * 100}%`;
  }
}
