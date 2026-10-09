import type { MessageKey } from '../../app/i18n/i18n';
import type { RoundController } from '../../app/RoundController';
import type { RoundEvent, RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import { html, type Screen } from '../dom';
import { AchievementCard, TITLE_CLASS } from '../overlays/AchievementCard';
import { CueLayer } from '../overlays/cues';
import { LobbyScreen } from './LobbyScreen';
import { PlayScreen } from './PlayScreen';
import { ResultScreen } from './ResultScreen';
import type { RoomPart } from './RoomPart';

/** 時間で動くもの(カウントダウン・グラフ)を描き直す間隔 */
const TICK_MS = 250;

/** 途中参加の人の称号を待つ時間(実績は、参加者の一覧より少しあとに届く) */
const BANNER_WAIT_MS = 4_000;

type PartKind = 'lobby' | 'play' | 'result';

/**
 * 部屋の中(集合中・プレイ中・結果発表)。RoundView の段階で、画面を出し分け、合図と実績カードを重ねる。
 *
 * view は、届くたびに描かず、1コマに1回にまとめる(数字が1秒に何十回も変わるため)。
 */
export class RoomScreen implements Screen {
  readonly element: HTMLElement;
  private readonly cues = new CueLayer();
  private part: RoomPart | null = null;
  private partKind: PartKind | null = null;
  private view: RoundView | null = null;
  private frame: number | null = null;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly offs: (() => void)[] = [];
  private card: AchievementCard | null = null;
  /** 称号の帯を待っている途中参加の人(id → 待つ期限。Date.now()) */
  private readonly awaitingBanner = new Map<string, number>();

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
      round.onEvent((event) => this.handle(event))
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

  private handle(event: RoundEvent): void {
    switch (event.kind) {
      case 'cue':
        this.cues.show(event.cue);
        break;
      case 'myPress':
        if (this.part instanceof PlayScreen) {
          this.part.myPress(event.press);
        }
        break;
      case 'summon':
        if (this.part instanceof PlayScreen) {
          this.part.summon(event.player.id, event.targetFrom, event.targetTo);
          this.awaitingBanner.set(event.player.id, Date.now() + BANNER_WAIT_MS);
        }
        break;
      case 'fadeIn':
        break; // 舞台が、あとから加わったAIを、ふわっと出す
    }
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
    const kind: PartKind =
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
    this.showBanners(view);
  }

  /** 称号(新人以外)が届いた途中参加の人の帯を出す(見本 06) */
  private showBanners(view: RoundView): void {
    for (const [id, until] of this.awaitingBanner) {
      const title = view.titles[id];
      const player = view.players.find((p) => p.id === id);
      if (Date.now() > until) {
        this.awaitingBanner.delete(id);
      } else if (title !== undefined && player !== undefined) {
        this.awaitingBanner.delete(id);
        if (title !== 'rookie' && this.part instanceof PlayScreen) {
          this.part.banner(
            `title.${title}` as MessageKey,
            TITLE_CLASS[title],
            player.name
          );
        }
      }
    }
  }

  private create(kind: PartKind): RoomPart {
    const onTap = (playerId: string) => void this.openCard(playerId);
    switch (kind) {
      case 'lobby':
        return new LobbyScreen(this.myId, this.config, onTap);
      case 'play':
        return new PlayScreen(
          this.myId,
          this.config,
          (press) => this.round.press(press),
          onTap
        );
      case 'result':
        return new ResultScreen(this.config);
    }
  }

  /** 13 実績カード(人間の小人をタップした) */
  private async openCard(playerId: string): Promise<void> {
    const player = this.view?.players.find((p) => p.id === playerId);
    if (player === undefined || this.card !== null) {
      return;
    }
    const card = new AchievementCard(
      player,
      this.view?.titles[playerId] ?? null,
      () => {
        card.element.remove();
        this.card = null;
      }
    );
    this.card = card;
    this.element.append(card.element);
    card.setStats(await this.round.statsOf(playerId));
  }
}
