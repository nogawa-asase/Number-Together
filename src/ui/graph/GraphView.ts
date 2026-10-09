import { t } from '../../app/i18n/i18n';
import type { RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import {
  graphMarkers,
  graphPoints,
  graphY,
  NOW_X,
} from '../../domain/layout/graphGeometry';
import { formatClock, html, ref, text } from '../dom';

/** SVG の座標の大きさ(見本 05。縦横は、要素の大きさに引き伸ばす) */
const W = 342;
const H = 140;
/** 「終了」の札を置ける、いちばん右の位置(%)。札の幅の半分だけ、右端から離す */
const END_LABEL_MAX_X = 90;

/**
 * グラフ(見本 05。docs/functional-design.md「9. グラフの描画」)。
 *
 * 線は「いま」まで。範囲の帯・目標の点線・×3ボーナスの帯・終了の線・残り時間・縦軸の数字を出す。
 */
export class GraphView {
  readonly element: HTMLElement;

  constructor(private readonly config: GameConfig) {
    this.element = html(`
<div class="graph-row">
  <div class="graph">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <rect data-ref="band" x="0" width="${W}" fill="#2EC27E" fill-opacity="0.45"></rect>
      <line data-ref="targetLine" x1="0" x2="${W}" stroke="#111111" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"></line>
      <polyline data-ref="line" fill="none" stroke="#FF5C8A" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></polyline>
    </svg>
    <div class="bonus-band" data-ref="bonusBand"></div>
    <div class="after-end" data-ref="afterEnd"></div>
    <div class="now-line" style="left: ${NOW_X}%"></div>
    <div class="now-dot" data-ref="nowDot" style="left: ${NOW_X}%"></div>
    <div class="remaining" data-ref="remaining"><span class="label" data-ref="remainingLabel"></span><span class="time" data-ref="remainingTime"></span></div>
    <div class="end-label" data-ref="endLabel"><span data-ref="end1"></span><span data-ref="end2"></span></div>
    <div class="end-line" data-ref="endLine"></div>
    <div class="bonus-tag-wrap" data-ref="bonusTag"><div class="bonus-tag"><div class="x3" data-ref="x3"></div><div class="word" data-ref="bonusWord"></div></div></div>
  </div>
  <div class="axis">
    <div data-ref="axisUpper"></div>
    <div data-ref="axisTarget"></div>
    <div data-ref="axisLower"></div>
  </div>
</div>`);
  }

  update(view: RoundView, nowMs: number): void {
    const el = this.element;
    const { config } = this;
    const { target } = view;
    const y = (value: number) => graphY(value, target);

    // 範囲の帯と、目標の点線
    const band = ref(el, 'band');
    band.setAttribute('y', String((y(view.upper) * H) / 100));
    band.setAttribute(
      'height',
      String(((y(view.lower) - y(view.upper)) * H) / 100)
    );
    const targetY = String((y(target) * H) / 100);
    ref(el, 'targetLine').setAttribute('y1', targetY);
    ref(el, 'targetLine').setAttribute('y2', targetY);

    // 線(いまの点は、まだ送っていない自分の分も含めた画面の数字)
    const samples = [...view.samples, { t: nowMs, value: view.number }];
    const points = graphPoints(samples, nowMs, target, config)
      .map(
        (p) => `${((p.x * W) / 100).toFixed(1)},${((p.y * H) / 100).toFixed(1)}`
      )
      .join(' ');
    ref(el, 'line').setAttribute('points', points);
    ref(el, 'nowDot').style.top = `${clamp(y(view.number))}%`;

    // ×3ボーナスの帯・終了の線
    const markers = graphMarkers(nowMs, view.clock, config);
    const bonusBand = ref(el, 'bonusBand');
    const bonusTag = ref(el, 'bonusTag');
    bonusBand.hidden = markers.bonusBand === null;
    bonusTag.hidden = markers.bonusBand === null;
    if (markers.bonusBand !== null) {
      const { fromX, toX } = markers.bonusBand;
      for (const element of [bonusBand, bonusTag]) {
        element.style.left = `${fromX}%`;
        element.style.width = `${toX - fromX}%`;
      }
    }
    const endX = markers.endLineX;
    for (const name of ['endLine', 'endLabel', 'afterEnd']) {
      const element = ref(el, name);
      element.hidden = endX === null;
      element.style.left = `${endX ?? 0}%`;
    }
    // 「終了」の札は、右端からはみ出さないように止める(線は、そのまま)
    ref(el, 'endLabel').style.left = `${Math.min(endX ?? 0, END_LABEL_MAX_X)}%`;
    text(ref(el, 'end1'), t('play.end1'));
    text(ref(el, 'end2'), t('play.end2'));
    text(ref(el, 'x3'), t('play.x3'));
    text(ref(el, 'bonusWord'), t('play.bonus'));

    // 残り時間(10秒前からは強調する)
    const remaining = Math.max(0, view.clock.playEndsAt - nowMs);
    text(ref(el, 'remainingLabel'), t('play.remaining'));
    text(ref(el, 'remainingTime'), formatClock(remaining));
    ref(el, 'remaining').classList.toggle(
      'urgent',
      remaining > 0 && remaining <= config.finalCountdownMs
    );

    // 縦軸の数字
    for (const [name, value] of [
      ['axisUpper', view.upper],
      ['axisTarget', target],
      ['axisLower', view.lower],
    ] as const) {
      const label = ref(el, name);
      label.style.top = `${y(value)}%`;
      text(label, String(value));
    }
  }
}

function clamp(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}
