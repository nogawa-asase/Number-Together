import { t } from '../../app/i18n/i18n';
import type { RoundController } from '../../app/RoundController';
import type { RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import { html, ref, type Screen, text } from '../dom';
import { CueLayer } from '../overlays/cues';
import { LobbyScreen } from './LobbyScreen';
import { PlayScreen } from './PlayScreen';
import type { RoomPart } from './RoomPart';

/** 時間で動くもの(カウントダウン・グラフ)を描き直す間隔 */
const TICK_MS = 250;

/**
 * 部屋の中(集合中・プレイ中・結果発表)。RoundView の段階で、画面を出し分け、合図を重ねる。
 *
 * view は、届くたびに描かず、1コマに1回にまとめる(数字が1秒に何十回も変わるため)。
 */
export class RoomScreen implements Screen {
  readonly element: HTMLElement;
  private readonly cues = new CueLayer();
  private part: RoomPart | null = null;
  private partKind: 'lobby' | 'play' | 'result' | null = null;
  private view: RoundView | null = null;
  private frame: number | null = null;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly offs: (() => void)[] = [];

  constructor(
    private readonly round: RoundController,
    private readonly myId: string,
    private readonly config: GameConfig,
    private readonly now: () => number
  ) {
    this.element = html('<div class="room"></div>');
    this.element.append(this.cues.element);
    this.offs.push(
      round.onView((view) => {
        this.view = view;
        this.schedule();
      }),
      round.onEvent((event) => {
        if (event.kind === 'cue') {
          this.cues.show(event.cue);
        } else if (
          event.kind === 'myPress' &&
          this.part instanceof PlayScreen
        ) {
          this.part.myPress(event.press);
        }
      })
    );
    this.timer = setInterval(() => this.schedule(), TICK_MS);
  }

  dispose(): void {
    for (const off of this.offs) {
      off();
    }
    clearInterval(this.timer);
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
    }
    this.cues.dispose();
    this.part?.dispose();
  }

  private schedule(): void {
    if (this.frame === null) {
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.render();
      });
    }
  }

  private render(): void {
    const { view } = this;
    if (view === null) {
      return;
    }
    const kind =
      view.clock.phase === 'gathering'
        ? 'lobby'
        : view.result === null
          ? 'play'
          : 'result';
    if (kind !== this.partKind) {
      this.part?.dispose();
      this.part?.element.remove();
      this.part = this.create(kind);
      this.partKind = kind;
      this.element.prepend(this.part.element);
      if (kind !== 'play') {
        this.cues.clear('tenSeconds', 'end');
      }
    }
    this.part!.update(view, this.now());
  }

  private create(kind: 'lobby' | 'play' | 'result'): RoomPart {
    switch (kind) {
      case 'lobby':
        return new LobbyScreen(this.myId, this.config);
      case 'play':
        return new PlayScreen(this.myId, this.config, (press) =>
          this.round.press(press)
        );
      case 'result':
        return new ResultStub();
    }
  }
}

/** 結果発表の仮の画面(次の作業で、見本 10〜12 の画面に置き換える) */
class ResultStub implements RoomPart {
  readonly element = html(`
<div class="screen">
  <div class="heading"><div class="title" data-ref="title"></div><div class="lead" data-ref="lead"></div></div>
</div>`);

  update(view: RoundView): void {
    text(ref(this.element, 'title'), t('phase.result'));
    const result = view.result!;
    text(
      ref(this.element, 'lead'),
      `${result.outcome} ${result.finalNumber} / ${result.target} · ${result.myPoints}${t('play.pointUnit')}`
    );
  }

  dispose(): void {}
}
