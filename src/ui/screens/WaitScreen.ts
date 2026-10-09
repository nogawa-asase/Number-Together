import type { WaitReason } from '../../app/SessionController';
import { formatClock, html, ref, type Screen, text, translate } from '../dom';

const TITLES: Readonly<
  Record<WaitReason, { title: string; lead: string | null }>
> = {
  full: { title: 'wait.full.title', lead: null },
  lastMinute: { title: 'wait.lastMinute.title', lead: 'wait.lastMinute.lead' },
  afterOffline: {
    title: 'wait.afterOffline.title',
    lead: 'wait.afterOffline.lead',
  },
};

/** 14 待機(満員)・15 待機(終了間際・結果発表中・通信が戻ったあと) */
export class WaitScreen implements Screen {
  readonly element: HTMLElement;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly total: number;

  constructor(
    reason: WaitReason,
    private readonly until: number,
    private readonly now: () => number // サーバー時刻
  ) {
    const { title, lead } = TITLES[reason];
    this.element = html(`
<div class="screen">
  <div class="heading">
    <div class="title" data-i18n="${title}"></div>
    ${lead === null ? '' : `<div class="lead" data-i18n="${lead}"></div>`}
  </div>
  <div class="wait-card">
    <div class="wait-label" data-i18n="wait.next"></div>
    <div class="wait-time" data-ref="time"></div>
    <div class="wait-bar"><div data-ref="bar"></div></div>
    <div class="wait-note" data-i18n="wait.note"></div>
  </div>
  <div class="dots waiting">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <div class="label" data-i18n="wait.waiting"></div>
  </div>
  <div class="spacer"></div>
</div>`);
    translate(this.element);
    this.total = Math.max(1, until - now());
    this.tick();
    this.timer = setInterval(() => this.tick(), 250);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  private tick(): void {
    const remaining = Math.max(0, this.until - this.now());
    text(ref(this.element, 'time'), formatClock(remaining));
    ref(this.element, 'bar').style.width = `${(remaining / this.total) * 100}%`;
  }
}
