import { type MessageKey, t } from '../../app/i18n/i18n';
import type { ResultView, RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import type { RankRow } from '../../domain/ranking/types';
import type { Player } from '../../domain/types';
import { formatNumber, html, ref, splitAround, text } from '../dom';
import { CHECK_SVG, CROSS_SVG, SPIKY_BURST, sparkleSvg } from '../shapes';
import { playerSvg } from '../stage/characterSvg';
import { robotSvg } from '../stage/robotSvg';
import type { RoomPart } from './RoomPart';

/** 結果ごとの見出しの色ときらめきの数(見本 10・11・12) */
const HEADS = {
  perfect: { fill: '#FF3B5C', sparkles: 4 },
  success: { fill: '#2EC27E', sparkles: 2 },
  fail: { fill: null, sparkles: 0 },
} as const;

const SPARKLES = [
  sparkleSvg('#FFFFFF', 'left: 14px; top: 18px; width: 14px; height: 14px'),
  sparkleSvg(
    '#3A86FF',
    'left: 6px; top: 70px; width: 12px; height: 12px; animation-delay: 0.6s'
  ),
  sparkleSvg(
    '#FF5C8A',
    'right: 12px; top: 10px; width: 18px; height: 18px; animation-delay: 0.3s'
  ),
  sparkleSvg(
    '#FFFFFF',
    'right: 4px; top: 74px; width: 14px; height: 14px; animation-delay: 0.45s'
  ),
];

/** 見出しが、この文字数より長ければ、小さくする(トゲトゲからはみ出さないように) */
const LONG_WORD = 6;

/** 順位の丸の色(1位は金、2位は銀、3位は銅) */
const RANK_COLORS = ['#FFC400', '#D5DCE4', '#D98A4B'];

/** 10・11・12 結果発表 */
export class ResultScreen implements RoomPart {
  readonly element: HTMLElement;
  private built = false;

  constructor(private readonly config: GameConfig) {
    this.element = html(`
<div class="screen result">
  <div class="result-head" data-ref="head"></div>
  <div class="card result-final">
    <div>
      <div class="label" data-ref="finalLabel"></div>
      <div class="value" data-ref="final"></div>
    </div>
    <div class="side">
      <div class="range-chip small" data-ref="chip"></div>
      <div class="target" data-ref="target"></div>
      <div class="range" data-ref="range"></div>
    </div>
  </div>
  <div class="card result-points">
    <div class="row">
      <div class="label" data-ref="pointsLabel"></div>
      <div class="total" data-ref="total"></div>
    </div>
    <div class="line" data-ref="pointsLine"></div>
  </div>
  <div class="card result-ranking">
    <div class="row">
      <div class="label" data-ref="everyone"></div>
      <div class="count" data-ref="count"></div>
    </div>
    <div class="rows" data-ref="rows"></div>
    <div class="others" data-ref="others"></div>
  </div>
  <div class="result-next">
    <div class="label" data-ref="nextLabel"></div>
    <div class="time" data-ref="nextTime"></div>
    <div class="bar"><div data-ref="bar"></div></div>
  </div>
</div>`);
  }

  dispose(): void {}

  update(view: RoundView, nowMs: number): void {
    const result = view.result!;
    if (!this.built) {
      this.built = true;
      this.build(view, result);
    }
    const remaining = Math.max(0, view.clock.nextRoundStartsAt - nowMs);
    text(ref(this.element, 'nextLabel'), t('result.next'));
    text(
      ref(this.element, 'nextTime'),
      t('result.countdown', { s: Math.ceil(remaining / 1_000) })
    );
    ref(this.element, 'bar').style.width =
      `${(remaining / this.config.resultMs) * 100}%`;
  }

  /** 結果は変わらないので、1回だけ組み立てる(つぎの回までの時間だけ、毎回描く) */
  private build(view: RoundView, result: ResultView): void {
    const el = this.element;
    this.buildHead(result, view);

    // 最終の数字と範囲
    text(ref(el, 'finalLabel'), t('result.final'));
    text(ref(el, 'final'), formatNumber(result.finalNumber));
    const chip = ref(el, 'chip');
    const chipKind =
      result.outcome === 'perfect'
        ? 'perfect'
        : result.outcome === 'success'
          ? 'in'
          : 'out';
    chip.classList.add(chipKind);
    chip.innerHTML = result.outcome === 'fail' ? CROSS_SVG : CHECK_SVG;
    chip.append(
      t(
        chipKind === 'perfect'
          ? 'result.chipPerfect'
          : chipKind === 'in'
            ? 'result.chipIn'
            : 'result.chipOut'
      )
    );
    text(
      ref(el, 'target'),
      t('result.target', { n: formatNumber(result.target) })
    );
    // 「成功の範囲」のあとでだけ折り返す(数字の途中で折り返さない)
    const upper = formatNumber(view.upper);
    const [label, lower, rest] = splitAround(
      (marker) => t('result.range', { lower: marker, upper }),
      formatNumber(view.lower)
    );
    const range = ref(el, 'range');
    range.replaceChildren(label, html('<span class="nums"></span>'));
    text(range.querySelector('.nums')!, lower + rest);

    this.buildPoints(result);
    this.buildRanking(view, result);
  }

  private buildHead(result: ResultView, view: RoundView): void {
    const head = ref(this.element, 'head');
    const { fill, sparkles } = HEADS[result.outcome];
    const word = t(`result.${result.outcome}` as MessageKey);
    head.innerHTML =
      SPARKLES.slice(0, sparkles).join('') +
      `<div class="burst${fill === null ? ' plain' : ''}">` +
      (fill === null
        ? ''
        : `<svg viewBox="0 0 200 200" preserveAspectRatio="none"><polygon points="${SPIKY_BURST}" fill="#111111" transform="translate(6 7)"></polygon><polygon points="${SPIKY_BURST}" fill="${fill}" stroke="#111111" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linejoin="round"></polygon></svg>`) +
      '<div class="word"></div></div><div class="note-wrap"><div class="note"></div></div>';
    const wordElement = head.querySelector<HTMLElement>('.word')!;
    text(wordElement, word);
    wordElement.classList.toggle('long', [...word].length > LONG_WORD); // 英語は長いので、小さくする
    const note = head.querySelector<HTMLElement>('.note')!;
    note.classList.toggle('gold', result.outcome === 'perfect');
    text(note, this.noteOf(result, view));
  }

  private noteOf(result: ResultView, view: RoundView): string {
    switch (result.outcome) {
      case 'perfect':
        return t('result.perfectNote');
      case 'success':
        return t('result.successNote');
      case 'fail':
        return t(
          result.finalNumber < view.lower ? 'result.under' : 'result.over',
          {
            n: formatNumber(result.missBy ?? 0),
          }
        );
    }
  }

  private buildPoints(result: ResultView): void {
    const el = this.element;
    const failed = result.outcome === 'fail';
    text(
      ref(el, 'pointsLabel'),
      t(failed ? 'result.keptPoints' : 'result.myPoints')
    );
    const total = ref(el, 'total');
    total.hidden = result.totalBefore === null;
    if (result.totalBefore !== null) {
      text(
        total,
        failed
          ? t('result.totalSame', { before: formatNumber(result.totalBefore) })
          : t('result.total', {
              before: formatNumber(result.totalBefore),
              after: formatNumber(result.totalBefore + result.awarded),
            })
      );
    }
    const unit = t('play.pointUnit');
    const line = ref(el, 'pointsLine');
    const points = (value: number, className: string) => {
      const span = html(
        `<div class="pts ${className}"><span></span><span class="unit"></span></div>`
      );
      text(span.firstElementChild!, String(value));
      text(span.lastElementChild!, unit);
      return span;
    };
    const chip = (key: MessageKey, className: string, params = {}) => {
      const element = html(`<div class="pill ${className}"></div>`);
      text(element, t(key, params));
      return element;
    };
    switch (result.outcome) {
      case 'perfect':
        line.append(
          points(result.myPoints, 'small'),
          chip('result.bonus', 'gold', { n: this.config.perfectMultiplier }),
          html('<div class="eq">=</div>'),
          points(result.awarded, 'big')
        );
        break;
      case 'success':
        line.append(
          points(result.awarded, 'big'),
          chip('result.earned', 'green')
        );
        break;
      case 'fail':
        line.append(
          points(result.myPoints, 'big lost'),
          chip('result.notEarned', 'gray')
        );
        break;
    }
  }

  private buildRanking(view: RoundView, result: ResultView): void {
    const el = this.element;
    const { top, me } = result.ranking;
    text(ref(el, 'everyone'), t('result.everyone'));
    text(ref(el, 'count'), t('result.count', { n: view.players.length }));
    const rows = ref(el, 'rows');
    rows.replaceChildren(...top.map((row) => this.row(row)));
    // 自分が圏外: 上位のすぐ下なら続けて、離れていれば「・・・」で区切って出す
    const gap = me !== null && me.rank > this.config.resultTopN + 1;
    if (me !== null) {
      if (gap) {
        rows.append(html('<div class="dots-row">・・・</div>'));
      }
      rows.append(this.row(me));
    }
    const shown = top.length + (me === null ? 0 : 1);
    const others = ref(el, 'others');
    const rest = view.players.length - shown;
    others.hidden = gap || rest <= 0;
    text(others, t('result.others', { n: rest }));
  }

  private row(row: RankRow): HTMLElement {
    const element = html(`
<div class="rank-row${row.isMe ? ' me' : ''}">
  <div class="rank" style="background: ${RANK_COLORS[row.rank - 1] ?? '#FFFFFF'}"></div>
  ${avatarOf(row.player)}
  <div class="name"></div>
  <div class="pts"><span></span><span class="unit"></span></div>
</div>`);
    text(element.querySelector('.rank')!, String(row.rank));
    const name = nameOf(row.player);
    text(
      element.querySelector('.name')!,
      row.isMe ? t('result.you', { name }) : name
    );
    text(element.querySelector('.pts span')!, String(row.points));
    text(element.querySelector('.pts .unit')!, t('play.pointUnit'));
    return element;
  }
}

/** 一覧の小人(人間は見た目、AIはロボット) */
function avatarOf(player: Player): string {
  if (player.kind === 'ai') {
    return robotSvg(player.personality, 'face');
  }
  return player.character === null
    ? ''
    : playerSvg(player.id, player.character, 'face');
}

/** 一覧に出す名前(AIは性格の名前。他の人の名前は、そのまま) */
export function nameOf(player: Player): string {
  if (player.kind === 'ai' && player.personality !== null) {
    return t(`ai.${player.personality}` as MessageKey);
  }
  return player.name;
}
