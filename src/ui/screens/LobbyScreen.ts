import { type MessageKey, t } from '../../app/i18n/i18n';
import type { RoundView } from '../../app/RoundView';
import type { GameConfig } from '../../domain/config/types';
import type { Player } from '../../domain/types';
import { formatNumber, html, ref, splitAround, text, translate } from '../dom';
import { playerSvg } from '../stage/characterSvg';
import { TITLE_CLASS } from '../overlays/AchievementCard';
import { robotBadgeSvg, robotSvg } from '../stage/robotSvg';
import type { RoomPart } from './RoomPart';

const TEMPLATE = `
<div class="screen lobby">
  <div class="card lobby-countdown">
    <div class="row">
      <div>
        <div class="label" data-i18n="lobby.nextStart"></div>
        <div class="count"><span class="unit" data-ref="before"></span><span class="num" data-ref="seconds"></span><span class="unit" data-ref="after"></span></div>
      </div>
      <div class="chip-dark" data-i18n="lobby.gathering"></div>
    </div>
    <div class="lobby-bar"><div data-ref="bar"></div></div>
  </div>
  <div class="card lobby-people">
    <div class="row">
      <div class="label" data-i18n="lobby.players"></div>
      <div class="count"><span data-ref="count"></span> <span class="unit" data-ref="capacity"></span></div>
    </div>
    <div class="ai-banner" data-ref="aiBanner">${robotBadgeSvg()}<div data-ref="aiText"></div></div>
    <div class="cells" data-ref="cells"></div>
    <div class="seats-open" data-ref="seatsOpen"></div>
  </div>
  <div class="card lobby-target">
    <div>
      <div class="label" data-i18n="lobby.target"></div>
      <div class="value" data-ref="target"></div>
    </div>
    <div class="side">
      <div class="formula" data-ref="formula"></div>
      <div class="range" data-ref="range"></div>
      <div class="note" data-ref="note"></div>
    </div>
  </div>
  <div class="lobby-hint" data-i18n="lobby.hint"></div>
</div>`;

/** 02・03 集合中 */
export class LobbyScreen implements RoomPart {
  readonly element: HTMLElement;
  private cellsKey = '';

  constructor(
    private readonly myId: string,
    private readonly config: GameConfig,
    private readonly onTap: (playerId: string) => void
  ) {
    this.element = html(TEMPLATE);
    translate(this.element);
  }

  dispose(): void {}

  update(view: RoundView, nowMs: number): void {
    const el = this.element;
    const { config } = this;

    // つぎの開始まで
    const remaining = Math.max(0, view.clock.playStartsAt - nowMs);
    const seconds = String(Math.ceil(remaining / 1_000));
    const [before, , after] = splitAround(
      (s) => t('lobby.countdown', { s }),
      seconds
    );
    text(ref(el, 'before'), before);
    text(ref(el, 'seconds'), seconds);
    text(ref(el, 'after'), after);
    ref(el, 'bar').style.width = `${(remaining / config.gatherMs) * 100}%`;

    // あつまった人
    const humans = view.players.filter((p) => p.kind === 'human');
    const aiSeats = Math.max(0, config.aiFillTo - humans.length);
    text(ref(el, 'count'), String(humans.length + aiSeats));
    text(
      ref(el, 'capacity'),
      t('lobby.capacity', { max: config.roomCapacity })
    );
    ref(el, 'aiBanner').hidden = aiSeats === 0;
    text(ref(el, 'aiText'), t('lobby.aiJoin', { n: aiSeats }));
    this.renderCells(humans, aiSeats, view);

    // いまの目標
    text(ref(el, 'target'), formatNumber(view.target));
    text(
      ref(el, 'formula'),
      t('lobby.formula', { n: view.playerCount, per: config.perPlayerTarget })
    );
    text(
      ref(el, 'range'),
      t('lobby.range', {
        lower: formatNumber(view.lower),
        upper: formatNumber(view.upper),
      })
    );
    text(ref(el, 'note'), t(aiSeats > 0 ? 'lobby.noteAi' : 'lobby.noteMore'));
  }

  /** 参加者の席。顔ぶれ・称号が変わったときだけ作り直す */
  private renderCells(
    humans: readonly Player[],
    aiSeats: number,
    view: RoundView
  ): void {
    const key = JSON.stringify([
      humans.map((p) => [p.id, view.titles[p.id] ?? null]),
      aiSeats,
    ]);
    if (key === this.cellsKey) {
      return;
    }
    this.cellsKey = key;
    const cells = ref(this.element, 'cells');
    const filled = humans.length + aiSeats;
    const few = filled <= this.config.aiFillTo; // 5人以下は1列(見本 03)、それより多いときは4列(見本 02)
    cells.className = few ? 'cells few' : 'cells grid';
    cells.replaceChildren(
      ...humans.map((player) => this.humanCell(player, view)),
      ...Array.from({ length: aiSeats }, (_, i) => this.aiCell(i))
    );
    const open = this.config.roomCapacity - filled;
    if (!few) {
      cells.append(...Array.from({ length: open }, () => this.emptyCell()));
    }
    const seatsOpen = ref(this.element, 'seatsOpen');
    seatsOpen.hidden = !few;
    text(seatsOpen, t('lobby.seatsOpen', { n: open }));
  }

  private humanCell(player: Player, view: RoundView): HTMLElement {
    const cell = html(
      `<div class="cell${player.id === this.myId ? ' me' : ''}">${
        player.character === null
          ? ''
          : playerSvg(player.id, player.character, 'bob')
      }<div class="name"></div><div class="title-chip" hidden></div></div>`
    );
    text(cell.querySelector('.name')!, player.name); // 他の人の名前は、文字として入れる
    cell.classList.add('tappable');
    cell.addEventListener('click', () => this.onTap(player.id));
    const title = view.titles[player.id];
    if (title !== undefined) {
      const chip = cell.querySelector<HTMLElement>('.title-chip')!;
      chip.hidden = false;
      chip.classList.add(TITLE_CLASS[title]);
      text(chip, t(`title.${title}` as MessageKey));
    }
    return cell;
  }

  private aiCell(index: number): HTMLElement {
    const cell = html(
      `<div class="cell ai" style="animation-delay: ${index * 0.5}s">${robotSvg(null, 'bob')}<div class="title-chip ai"></div></div>`
    );
    // まだ性格が決まっていない(ゲーム開始のときに決まる)ので、名前は出さず、「AI」の札だけ
    text(cell.querySelector('.title-chip')!, t('ai.tag'));
    return cell;
  }

  private emptyCell(): HTMLElement {
    const cell = html('<div class="cell empty"></div>');
    text(cell, t('lobby.empty'));
    return cell;
  }
}
