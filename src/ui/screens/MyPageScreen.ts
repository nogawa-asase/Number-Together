import { type MessageKey, t } from '../../app/i18n/i18n';
import type { GameConfig } from '../../domain/config/types';
import { titleOf } from '../../domain/titles/titleOf';
import type { Profile, Stats } from '../../domain/types';
import { html, ref, type Screen, text, translate } from '../dom';
import { statTiles, TITLE_CLASS } from '../overlays/AchievementCard';
import { playerSvg } from '../stage/characterSvg';

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"></path></svg>';

/** MyPageScreen が使うもの */
export interface MyPageDeps {
  readonly uid: string;
  readonly profile: Profile;
  readonly config: GameConfig;
  readonly reduceMotion: boolean;
  readonly onReduceMotion: (on: boolean) => void;
  readonly onEdit: () => void; // 名前・キャラをかえる
  readonly onClose: () => void;
}

/** 18 自分の画面(右上の「じぶん」から開き、×で閉じる) */
export class MyPageScreen implements Screen {
  readonly element: HTMLElement;
  private readonly config: GameConfig;

  constructor(deps: MyPageDeps) {
    this.config = deps.config;
    this.element = html(`
<div class="overlay-screen">
  <div class="screen me">
    <div class="me-head">
      <div class="title" data-i18n="me.title"></div>
      <button type="button" class="close-btn" data-ref="close">${CLOSE_ICON}</button>
    </div>
    <div class="card me-profile">
      <div class="portrait"><div class="ground"></div>${playerSvg(deps.uid, deps.profile.character, 'bob')}</div>
      <div class="who">
        <div class="name" data-ref="name"></div>
        <div><span class="title-chip big" data-ref="title" hidden></span></div>
        <button type="button" class="edit" data-ref="edit" data-i18n="me.edit"></button>
      </div>
    </div>
    <div class="card me-section">
      <div class="heading-small" data-i18n="me.records"></div>
      <div class="stats" data-ref="stats"></div>
    </div>
    <div class="card me-section">
      <div class="heading-small" data-i18n="me.settings"></div>
      <div class="setting">
        <div>
          <div class="name" data-i18n="me.reduceMotion"></div>
          <div class="note" data-i18n="me.reduceMotionNote"></div>
        </div>
        <button type="button" class="switch" role="switch" data-ref="switch"></button>
      </div>
    </div>
    <div class="spacer"></div>
    <div class="setup-warning" data-i18n="setup.warning"></div>
  </div>
</div>`);
    translate(this.element);
    text(ref(this.element, 'name'), deps.profile.name);
    ref(this.element, 'close').setAttribute('aria-label', t('me.close'));
    ref(this.element, 'close').addEventListener('click', deps.onClose);
    ref(this.element, 'edit').addEventListener('click', deps.onEdit);

    const toggle = ref(this.element, 'switch');
    toggle.setAttribute('aria-label', t('me.reduceMotion'));
    let on = deps.reduceMotion;
    const show = () => toggle.setAttribute('aria-checked', String(on));
    show();
    toggle.addEventListener('click', () => {
      on = !on;
      show();
      deps.onReduceMotion(on);
    });
    this.setStats(null);
  }

  /** 実績が届いた(読めなければ「—」のまま) */
  setStats(stats: Stats | null): void {
    ref(this.element, 'stats').replaceChildren(...statTiles(stats));
    const chip = ref(this.element, 'title');
    chip.hidden = stats === null;
    if (stats !== null) {
      const title = titleOf(stats, this.config);
      chip.className = `title-chip big ${TITLE_CLASS[title]}`;
      text(chip, t(`title.${title}` as MessageKey));
    }
  }

  dispose(): void {}
}
