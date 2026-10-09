import { type MessageKey, t } from '../../app/i18n/i18n';
import type { RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import type { PressKind } from '../../domain/points/types';
import { html, ref, text } from '../dom';
import { CHECK_SVG, SPIKY_BUBBLE } from '../shapes';
import { GraphView } from '../graph/GraphView';
import { StageView } from '../stage/StageView';
import type { RoomPart } from './RoomPart';

/** 「目標UP!」と称号の帯を出しておく長さ(CSS の pop と同じ) */
const OVERLAY_MS = 5_000;

/** 05 プレイ中(舞台・いまの数字・グラフ・あなたのポイント・ボタン) */
export class PlayScreen implements RoomPart {
  readonly element: HTMLElement;
  private readonly stage: StageView;
  private readonly graph: GraphView;
  private shownPoints: number | null = null;

  constructor(
    myId: string,
    config: GameConfig,
    onPress: (kind: PressKind) => void,
    onTap: (playerId: string) => void
  ) {
    this.stage = new StageView(myId, onTap);
    this.graph = new GraphView(config);
    this.element = html(`
<div class="screen play">
  <div class="card play-card" data-ref="card">
    <div class="number-row">
      <div>
        <div class="label" data-ref="currentLabel"></div>
        <div class="number" data-ref="number"></div>
      </div>
      <div class="range-chip" data-ref="range">${CHECK_SVG}<span data-ref="rangeText"></span></div>
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
      <polygon points="${SPIKY_BUBBLE}" fill="#111111" transform="translate(5 6)"></polygon>
      <polygon points="${SPIKY_BUBBLE}" fill="#FFFFFF" stroke="#111111" stroke-width="4" stroke-linejoin="round"></polygon>
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

  /** 途中参加: 小人が降りてきて、「目標UP! from → to」の吹き出しを出す(見本 05) */
  summon(playerId: string, targetFrom: number, targetTo: number): void {
    this.stage.summon(playerId);
    const bubble = html(`
<div class="target-up">
  <svg viewBox="0 0 240 150">
    <g transform="translate(0 150) scale(1 -1)">
      <polygon points="${SPIKY_BUBBLE}" fill="#111111" transform="translate(5 -6)"></polygon>
      <polygon points="${SPIKY_BUBBLE}" fill="#FFFFFF" stroke="#111111" stroke-width="4" stroke-linejoin="round"></polygon>
    </g>
    <text x="120" y="86" text-anchor="middle" class="up"></text>
    <text x="120" y="112" text-anchor="middle" class="change"></text>
  </svg>
</div>`);
    text(bubble.querySelector('.up')!, t('summon.targetUp'));
    text(bubble.querySelector('.change')!, `${targetFrom} → ${targetTo}`);
    this.element.append(bubble);
    setTimeout(() => bubble.remove(), OVERLAY_MS); // 動きをへらしているときは、動きの終わりが来ない
  }

  /** 称号のある人の途中参加: 「ぴったり王 さくらさん 参戦!」の帯(見本 06) */
  banner(titleKey: MessageKey, titleClass: string, name: string): void {
    const banner = html(
      `<div class="join-banner"><span class="title-chip ${titleClass}"></span><span class="who"></span></div>`
    );
    text(banner.querySelector('.title-chip')!, t(titleKey));
    text(banner.querySelector('.who')!, t('summon.joins', { name }));
    this.element.append(banner);
    setTimeout(() => banner.remove(), OVERLAY_MS);
  }
}

/** CSS の動きを、最初から始め直す */
function restart(element: HTMLElement, className: string): void {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
