import { t } from '../../app/i18n/i18n';
import type { RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import type { PressKind } from '../../domain/points/types';
import { html, ref, text } from '../dom';
import { GraphView } from '../graph/GraphView';
import { StageView } from '../stage/StageView';
import type { RoomPart } from './RoomPart';

/** トゲトゲの吹き出しの形(見本 05。しっぽなし) */
const SPIKY =
  '120.0,11.0 136.5,24.7 162.5,12.3 167.2,31.5 192.4,29.6 191.5,44.1 226.3,44.8 206.2,61.0 228.2,69.3 209.2,79.7 227.7,92.5 200.2,97.8 213.8,115.5 180.4,112.8 176.6,127.2 152.4,122.7 141.8,141.7 120.0,126.2 100.0,136.0 87.6,122.7 61.0,129.4 59.6,112.8 26.2,115.5 39.8,97.8 16.6,91.8 30.8,79.7 1.8,68.7 33.8,61.0 22.7,47.3 48.5,44.1 44.5,27.7 72.8,31.5 77.5,12.3 103.5,24.7';

const CHECK =
  '<svg viewBox="0 0 24 24" class="check" fill="none" stroke="#111111" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 L10 18.5 L20 6"></path></svg>';

/** 05 プレイ中(舞台・いまの数字・グラフ・あなたのポイント・ボタン) */
export class PlayScreen implements RoomPart {
  readonly element: HTMLElement;
  private readonly stage: StageView;
  private readonly graph: GraphView;
  private shownPoints: number | null = null;

  constructor(
    myId: string,
    config: GameConfig,
    onPress: (kind: PressKind) => void
  ) {
    this.stage = new StageView(myId);
    this.graph = new GraphView(config);
    this.element = html(`
<div class="screen play">
  <div class="card play-card" data-ref="card">
    <div class="number-row">
      <div>
        <div class="label" data-ref="currentLabel"></div>
        <div class="number" data-ref="number"></div>
      </div>
      <div class="range-chip" data-ref="range">${CHECK}<span data-ref="rangeText"></span></div>
    </div>
  </div>
  <div class="points-board">
    <div class="label" data-ref="pointsLabel"></div>
    <div class="value"><span class="bump" data-ref="bump"><span data-ref="points"></span><span class="unit" data-ref="unit"></span></span></div>
  </div>
  <div class="press-row">
    <button type="button" class="btn press minus" data-ref="minus">−1</button>
    <button type="button" class="btn press plus" data-ref="plus">+1</button>
  </div>
  <div class="x3-bubble" data-ref="x3Bubble" hidden>
    <svg viewBox="0 0 240 170">
      <polygon points="${SPIKY}" fill="#111111" transform="translate(5 6)"></polygon>
      <polygon points="${SPIKY}" fill="#FFFFFF" stroke="#111111" stroke-width="4" stroke-linejoin="round"></polygon>
      <text x="120" y="62" text-anchor="middle" class="press-now" data-ref="pressNow"></text>
      <text x="120" y="108" text-anchor="middle" class="press-x3" data-ref="pressX3"></text>
    </svg>
  </div>
</div>`);
    const card = ref(this.element, 'card');
    card.prepend(this.stage.element);
    card.append(this.graph.element);
    ref(this.element, 'plus').addEventListener('click', () => onPress('+1'));
    ref(this.element, 'minus').addEventListener('click', () => onPress('-1'));
  }

  dispose(): void {}

  update(view: RoundView, nowMs: number): void {
    const el = this.element;
    this.stage.update(view, nowMs);
    this.graph.update(view, nowMs);

    text(ref(el, 'currentLabel'), t('play.current'));
    text(ref(el, 'number'), String(view.number));
    ref(el, 'range').classList.toggle('out', !view.inRange);
    text(
      ref(el, 'rangeText'),
      t(view.inRange ? 'play.inRange' : 'play.outOfRange')
    );

    text(ref(el, 'pointsLabel'), t('play.myPoints'));
    text(ref(el, 'points'), String(view.myPoints));
    text(ref(el, 'unit'), t('play.pointUnit'));
    if (this.shownPoints !== null && view.myPoints > this.shownPoints) {
      restart(ref(el, 'bump'), 'bumping'); // 増えたら、ぽんと弾む
    }
    this.shownPoints = view.myPoints;

    const playing = view.clock.phase === 'playing';
    ref(el, 'x3Bubble').hidden = !(playing && view.bonusActive);
    text(ref(el, 'pressNow'), t('play.pressNow'));
    text(ref(el, 'pressX3'), t('play.pressX3'));
    for (const name of ['plus', 'minus']) {
      ref<HTMLButtonElement>(el, name).disabled = !playing;
    }
  }

  /** 自分が押した */
  myPress(kind: PressKind): void {
    this.stage.myPress(kind);
  }
}

/** CSS の動きを、最初から始め直す */
function restart(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
