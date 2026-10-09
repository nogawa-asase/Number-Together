import { type MessageKey, t } from '../../app/i18n/i18n';
import type { Player, Stats, TitleId } from '../../domain/types';
import { formatNumber, html, ref, text } from '../dom';
import { playerSvg } from '../stage/characterSvg';

/** 称号の札の色のクラス */
export const TITLE_CLASS: Readonly<Record<TitleId, string>> = {
  rookie: 'rookie',
  regular: 'regular',
  hoarder: 'hoarder',
  perfectKing: 'king',
};

/**
 * 13 実績カード。人間の小人をタップすると、暗くして中央に出す。ほかをタップすると閉じる。
 * 実績は、読めるまで(読めなければ、ずっと)「—」
 */
export class AchievementCard {
  readonly element: HTMLElement;

  constructor(player: Player, title: TitleId | null, onClose: () => void) {
    this.element = html(`
<div class="card-overlay">
  <div class="dim"></div>
  <div class="card achievement">
    <div class="top">
      <div class="portrait"><div class="ground"></div><div data-ref="avatar"></div></div>
      <div class="who">
        <div class="name" data-ref="name"></div>
        <div><span class="title-chip big" data-ref="title" hidden></span></div>
      </div>
    </div>
    <div class="stats" data-ref="stats"></div>
    <div class="close-note" data-ref="close"></div>
  </div>
</div>`);
    if (player.character !== null) {
      ref(this.element, 'avatar').innerHTML = playerSvg(
        player.id,
        player.character
      );
    }
    text(ref(this.element, 'name'), player.name);
    if (title !== null) {
      const chip = ref(this.element, 'title');
      chip.hidden = false;
      chip.classList.add(TITLE_CLASS[title]);
      text(chip, t(`title.${title}` as MessageKey));
    }
    text(ref(this.element, 'close'), t('card.close'));
    ref(this.element, 'stats').append(...statTiles(null));
    this.element.addEventListener('click', onClose);
  }

  /** 実績が届いた */
  setStats(stats: Stats | null): void {
    ref(this.element, 'stats').replaceChildren(...statTiles(stats));
  }
}

/** 参加・成功・ぴったり成功・累計ポイントの4つ(実績カードと、自分の画面で使う) */
export function statTiles(stats: Stats | null): HTMLElement[] {
  const value = (n: number | undefined) =>
    n === undefined ? t('card.unknown') : formatNumber(n);
  const tiles: [MessageKey, number | undefined, MessageKey][] = [
    ['card.played', stats?.plays, 'card.times'],
    ['card.successes', stats?.successes, 'card.times'],
    ['card.perfects', stats?.perfects, 'card.times'],
    ['card.total', stats?.totalPoints, 'play.pointUnit'],
  ];
  return tiles.map(([label, n, unit]) => {
    const tile = html(
      '<div class="stat-tile"><div class="label"></div><div class="value"><span></span><span class="unit"></span></div></div>'
    );
    text(tile.querySelector('.label')!, t(label));
    text(tile.querySelector('.value span')!, value(n));
    text(tile.querySelector('.unit')!, ` ${t(unit)}`);
    return tile;
  });
}
