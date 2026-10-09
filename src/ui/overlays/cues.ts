import type { Cue } from '../../app/RoundView';
import { t } from '../../app/i18n/i18n';
import { html, ref, text } from '../dom';

const SPARKLE =
  '<path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z" stroke="#111111" stroke-width="1.2" stroke-linejoin="round"/>';

/** ×3タイムの、赤いトゲトゲ(見本 07) */
const X3_BURST =
  '100.0,8.0 115.6,31.8 141.9,13.0 143.6,45.3 169.8,44.4 163.0,69.7 195.1,78.3 169.9,100.0 187.9,120.1 163.0,130.3 174.8,159.7 143.6,154.7 137.9,178.7 115.6,168.2 100.0,192.0 84.4,168.2 58.1,187.0 56.4,154.7 30.2,155.6 37.0,130.3 4.9,121.7 30.1,100.0 12.1,79.9 37.0,69.7 25.2,40.3 56.4,45.3 62.1,21.3 84.4,31.8';

/** 「3・2・1・スタート!」の長さ(1秒ずつ。最後の「スタート!」も1秒) */
const START_MS = 4_000;
/** 「×3 タイム!」を出しておく長さ */
const X3_MS = 2_500;

/**
 * 合図の演出(見本 04・07・08・09)。部屋の画面の上に重ねる。
 *
 * - start: 「3」「2」「1」「スタート!」を1秒ずつ
 * - x3: 暗くして、赤いトゲトゲの「×3 タイム!」と札
 * - tenSeconds: 画面のふちを赤く点滅(終了まで)
 * - end: 暗くして、「終了!」の帯と「判定しています」(結果が出るまで)
 */
export class CueLayer {
  readonly element: HTMLElement;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    this.element = html('<div class="cue-layer"></div>');
  }

  show(cue: Cue): void {
    switch (cue) {
      case 'start':
        this.temporary(this.startCountdown(), START_MS);
        break;
      case 'x3':
        this.temporary(this.x3(), X3_MS);
        break;
      case 'tenSeconds':
        this.add(html('<div class="cue warn" data-cue="tenSeconds"></div>'));
        break;
      case 'end':
        this.clear('tenSeconds');
        this.add(this.end());
        break;
    }
  }

  /** 終わりの合図(10秒前・終了!)を消す(結果が出た・次の回になった) */
  clear(...cues: Cue[]): void {
    for (const cue of cues) {
      this.element
        .querySelectorAll(`[data-cue="${cue}"]`)
        .forEach((e) => e.remove());
    }
  }

  dispose(): void {
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
  }

  private add(element: HTMLElement): void {
    this.element.append(element);
  }

  private temporary(element: HTMLElement, ms: number): void {
    this.add(element);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      element.remove();
    }, ms);
    this.timers.add(timer);
  }

  private startCountdown(): HTMLElement {
    const element = html(`
<div class="cue" data-cue="start">
  <div class="cd" style="animation-delay: 0s">3</div>
  <div class="cd" style="animation-delay: 1s">2</div>
  <div class="cd" style="animation-delay: 2s">1</div>
  <div class="cd go" style="animation-delay: 3s" data-ref="go"></div>
</div>`);
    text(ref(element, 'go'), t('cue.go'));
    return element;
  }

  private x3(): HTMLElement {
    const element = html(`
<div class="cue" data-cue="x3">
  <div class="dim"></div>
  <svg class="tw" viewBox="0 0 12 12" fill="#FFFFFF" style="left: 34px; top: 300px; width: 22px; height: 22px">${SPARKLE}</svg>
  <svg class="tw" viewBox="0 0 12 12" fill="#FFC400" style="right: 30px; top: 290px; width: 26px; height: 26px; animation-delay: 0.3s">${SPARKLE}</svg>
  <svg class="tw" viewBox="0 0 12 12" fill="#FF5C8A" style="left: 60px; top: 520px; width: 18px; height: 18px; animation-delay: 0.6s">${SPARKLE}</svg>
  <svg class="tw" viewBox="0 0 12 12" fill="#FFFFFF" style="right: 56px; top: 524px; width: 20px; height: 20px; animation-delay: 0.45s">${SPARKLE}</svg>
  <div class="beat x3-burst">
    <svg viewBox="0 0 200 200" preserveAspectRatio="none">
      <polygon points="${X3_BURST}" fill="#111111" transform="translate(6 7)"></polygon>
      <polygon points="${X3_BURST}" fill="#FF3B5C" stroke="#111111" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linejoin="round"></polygon>
    </svg>
    <div class="x3-word" data-ref="word"></div>
  </div>
  <div class="x3-note"><div data-ref="note"></div></div>
</div>`);
    text(ref(element, 'word'), t('cue.x3'));
    text(ref(element, 'note'), t('cue.x3Note'));
    return element;
  }

  private end(): HTMLElement {
    const element = html(`
<div class="cue" data-cue="end">
  <div class="dim dark"></div>
  <div class="slam"><div data-ref="word"></div></div>
  <div class="judging dots">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <div class="label" data-ref="judging"></div>
  </div>
</div>`);
    text(ref(element, 'word'), t('cue.end'));
    text(ref(element, 'judging'), t('cue.judging'));
    return element;
  }
}
