import { t } from '../../app/i18n/i18n';
import type { RoundController, RoundView } from '../../app/RoundController';
import { html, ref, type Screen, text } from '../dom';

/**
 * 仮の部屋の画面。集合中・プレイ中・結果発表の画面(次の作業)ができるまで、
 * 数字・目標・自分のポイントと、+1・−1のボタンだけを出す
 */
export class TempRoomScreen implements Screen {
  readonly element: HTMLElement;
  private readonly off: () => void;

  constructor(round: RoundController) {
    this.element = html(`
<div class="screen temp-room">
  <div class="heading">
    <div class="title" data-ref="phase"></div>
    <div class="lead" data-ref="detail"></div>
  </div>
  <div class="card">
    <div class="big" data-ref="number"></div>
    <div class="row"><span data-ref="targetLabel"></span><span data-ref="target"></span></div>
    <div class="row"><span data-ref="pointsLabel"></span><span data-ref="points"></span></div>
    <div class="row"><span></span><span class="chip" data-ref="range"></span></div>
  </div>
  <div class="spacer"></div>
  <div class="press-buttons">
    <button type="button" class="btn minus" data-ref="minus">−1</button>
    <button type="button" class="btn plus" data-ref="plus">+1</button>
  </div>
</div>`);
    ref(this.element, 'plus').addEventListener('click', () =>
      round.press('+1')
    );
    ref(this.element, 'minus').addEventListener('click', () =>
      round.press('-1')
    );
    this.off = round.onView((view) => {
      if (view !== null) {
        this.render(view);
      }
    });
  }

  dispose(): void {
    this.off();
  }

  private render(view: RoundView): void {
    const el = this.element;
    text(ref(el, 'phase'), t(`phase.${view.clock.phase}`));
    text(
      ref(el, 'detail'),
      view.result === null ? `${view.playerCount}` : view.result.outcome
    );
    text(ref(el, 'number'), view.number.toLocaleString());
    text(ref(el, 'targetLabel'), t('room.target'));
    text(ref(el, 'target'), view.target.toLocaleString());
    text(ref(el, 'pointsLabel'), t('room.myPoints'));
    text(ref(el, 'points'), view.myPoints.toLocaleString());
    const range = ref(el, 'range');
    text(range, t(view.inRange ? 'room.inRange' : 'room.outOfRange'));
    range.className = `chip ${view.inRange ? 'in' : 'out'}`;
  }
}
