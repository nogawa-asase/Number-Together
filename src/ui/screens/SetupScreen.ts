import { t } from '../../app/i18n/i18n';
import {
  ACCESSORIES,
  DEFAULT_CHARACTER,
  HAIRS,
  randomCharacter,
  SHIRT_COLORS,
} from '../../domain/character/parts';
import type { GameConfig } from '../../domain/config/types';
import { nameUnits } from '../../domain/names/nameUnits';
import { validateName } from '../../domain/names/validateName';
import type { CharacterSpec } from '../../domain/types';
import { html, ref, type Screen, text, translate } from '../dom';
import {
  characterSvg,
  playerSvg,
  SAMPLE_COLORS,
  SHIRT_HEX,
} from '../stage/characterSvg';

const SPARKLE =
  '<path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z" stroke="#111111" stroke-width="1.2" stroke-linejoin="round"/>';

const CLOSE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="3.5" stroke-linecap="round" aria-hidden="true"><path d="M5 5 L19 19 M19 5 L5 19"></path></svg>';

const TEMPLATE = `
<div class="screen setup">
  <div class="heading setup-heading">
    <div>
      <div class="title" data-ref="title" data-i18n="setup.title"></div>
      <div class="lead" data-ref="lead" data-i18n="setup.lead"></div>
    </div>
    <button type="button" class="close-btn" data-ref="close" hidden>${CLOSE_ICON}</button>
  </div>
  <div class="setup-preview">
    <div class="ground"></div>
    <div data-ref="preview"></div>
    <svg class="sparkle" viewBox="0 0 12 12" style="left: 96px; top: 24px; width: 14px; height: 14px" fill="#FFFFFF">${SPARKLE}</svg>
    <svg class="sparkle" viewBox="0 0 12 12" style="right: 100px; top: 40px; width: 12px; height: 12px" fill="#FF5C8A">${SPARKLE}</svg>
    <div class="name" data-ref="previewName"></div>
  </div>
  <div class="card setup-card">
    <div class="setup-row-head">
      <label class="setup-label" for="setup-name" data-i18n="setup.nameLabel"></label>
      <div class="note-gray" data-i18n="setup.nameNote"></div>
    </div>
    <div class="setup-input">
      <input id="setup-name" data-ref="name" type="text" autocomplete="off" enterkeyhint="done" />
      <div class="setup-count" data-ref="count"></div>
    </div>
  </div>
  <div class="card setup-card">
    <div class="setup-group">
      <div class="setup-label" data-i18n="setup.hair"></div>
      <div class="setup-choices" data-ref="hairs"></div>
    </div>
    <div class="setup-group">
      <div class="setup-label" data-i18n="setup.shirt"></div>
      <div class="swatches" data-ref="shirts"></div>
    </div>
    <div class="setup-group">
      <div class="setup-label" data-i18n="setup.accessory"></div>
      <div class="setup-choices" data-ref="accessories"></div>
    </div>
  </div>
  <div class="setup-buttons">
    <button type="button" class="btn random" data-ref="random" data-i18n="setup.random"></button>
    <button type="button" class="btn decide" data-ref="decide" data-i18n="setup.decide"></button>
  </div>
  <div class="setup-warning" data-i18n="setup.warning"></div>
</div>`;

/** SetupScreen が使うもの */
export interface SetupDeps {
  readonly uid: string; // 髪と肌の色を決める
  readonly config: GameConfig;
  readonly initial: { name: string; character: CharacterSpec } | null;
  /** 決めた。保存できたら true(失敗したら、もう一度押せるようにする) */
  readonly onDecide: (
    name: string,
    character: CharacterSpec
  ) => Promise<boolean>;
  /** 自分の画面から開いたとき(名前とキャラの変更)は、閉じる。初回の登録では、なし */
  readonly onClose?: () => void;
}

/** 01 名前とキャラクター選び */
export class SetupScreen implements Screen {
  readonly element: HTMLElement;
  private character: CharacterSpec;
  private busy = false;

  constructor(private readonly deps: SetupDeps) {
    this.element = html(TEMPLATE);
    if (deps.onClose !== undefined) {
      // 変更: 見出しを変え、閉じるボタンを出す
      ref(this.element, 'title').dataset.i18n = 'me.editTitle';
      ref(this.element, 'title').classList.add('edit');
      ref(this.element, 'lead').dataset.i18n = 'me.editLead';
      const close = ref(this.element, 'close');
      close.hidden = false;
      close.addEventListener('click', deps.onClose);
    }
    translate(this.element);
    this.character = deps.initial?.character ?? DEFAULT_CHARACTER;
    this.nameInput.value = deps.initial?.name ?? '';
    this.buildChoices();
    this.nameInput.addEventListener('input', () => this.refresh());
    this.nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        void this.decide();
      }
    });
    ref(this.element, 'random').addEventListener('click', () => {
      this.character = randomCharacter({ next: Math.random });
      this.refresh();
    });
    ref(this.element, 'decide').addEventListener('click', () => {
      void this.decide();
    });
    this.refresh();
  }

  /** いまの入力(言語を切り替えて作り直すときに引き継ぐ) */
  snapshot(): { name: string; character: CharacterSpec } {
    return { name: this.nameInput.value, character: this.character };
  }

  dispose(): void {}

  private get nameInput(): HTMLInputElement {
    return ref<HTMLInputElement>(this.element, 'name');
  }

  private buildChoices(): void {
    const sample = (spec: CharacterSpec) => characterSvg(spec, SAMPLE_COLORS);
    const hairs = ref(this.element, 'hairs');
    for (const hair of HAIRS) {
      hairs.append(
        this.choice(
          'hair',
          hair,
          sample({ ...DEFAULT_CHARACTER, hair, accessory: 'none' }),
          () => {
            this.character = { ...this.character, hair };
          }
        )
      );
    }
    const shirts = ref(this.element, 'shirts');
    for (const shirtColor of SHIRT_COLORS) {
      const swatch = html<HTMLButtonElement>(
        `<button type="button" class="swatch" data-value="${shirtColor}" style="background: ${SHIRT_HEX[shirtColor]}" aria-label="${shirtColor}"></button>`
      );
      swatch.addEventListener('click', () => {
        this.character = { ...this.character, shirtColor };
        this.refresh();
      });
      shirts.append(swatch);
    }
    const accessories = ref(this.element, 'accessories');
    for (const accessory of ACCESSORIES) {
      // 見本と同じく、リボンは、ポニーテールの子でみせる
      const hair = accessory === 'ribbon' ? 'ponytail' : 'short';
      const face =
        accessory === 'none'
          ? ''
          : sample({ hair, shirtColor: 'pink', accessory });
      const element = this.choice('accessory', accessory, face, () => {
        this.character = { ...this.character, accessory };
      });
      if (accessory === 'none') {
        element.classList.add('text');
        element.dataset.i18n = 'setup.none';
        element.textContent = t('setup.none');
      }
      accessories.append(element);
    }
  }

  private choice(
    group: string,
    value: string,
    inner: string,
    select: () => void
  ): HTMLButtonElement {
    const button = html<HTMLButtonElement>(
      `<button type="button" class="choice" data-group="${group}" data-value="${value}">${inner}</button>`
    );
    button.addEventListener('click', () => {
      select();
      this.refresh();
    });
    return button;
  }

  private refresh(): void {
    const { character, element } = this;
    const name = this.nameInput.value;
    const preview = ref(element, 'preview');
    preview.innerHTML = playerSvg(this.deps.uid, character, 'me bob');
    text(ref(element, 'previewName'), name.trim());

    const used = nameUnits(name.trim());
    const max = this.deps.config.nameMaxUnits;
    const count = ref(element, 'count');
    text(count, t('setup.count', { used, max }));
    count.classList.toggle('over', used > max);

    const selected: Record<string, string> = {
      hair: character.hair,
      accessory: character.accessory,
    };
    for (const button of element.querySelectorAll<HTMLElement>('.choice')) {
      button.classList.toggle(
        'selected',
        selected[button.dataset.group!] === button.dataset.value
      );
    }
    for (const swatch of element.querySelectorAll<HTMLElement>('.swatch')) {
      swatch.classList.toggle(
        'selected',
        swatch.dataset.value === character.shirtColor
      );
    }
    const decide = ref<HTMLButtonElement>(element, 'decide');
    decide.disabled = this.busy || !validateName(name, this.deps.config).ok;
  }

  private async decide(): Promise<void> {
    const name = this.nameInput.value;
    if (this.busy || !validateName(name, this.deps.config).ok) {
      return;
    }
    this.busy = true;
    this.refresh();
    const saved = await this.deps.onDecide(name, this.character);
    if (!saved) {
      this.busy = false;
      this.refresh();
    }
  }
}
