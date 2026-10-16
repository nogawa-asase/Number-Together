import { t } from '../../app/i18n/i18n';
import type { RoundView } from '../../app/RoundView';
import { jumpFor } from '../../domain/layout/jumpFor';
import {
  DEFAULT_STAGE_METRICS as METRICS,
  type StageMetrics,
} from '../../domain/layout/stageMetrics';
import { stageLayout } from '../../domain/layout/stageLayout';
import type { Player } from '../../domain/types';
import { html, ref, text } from '../dom';
import { sparkleSvg } from '../shapes';
import { playerSvg } from './characterSvg';
import { robotSvg } from './robotSvg';

/** 舞台の内側の幅の既定(390px の画面。測れないとき) */
const DEFAULT_STAGE_WIDTH = 308;

/** 召喚の長さ(CSS の summon・beam と同じ) */
const SUMMON_MS = 4_500;

/** 「あなた」の吹き出しの矢印の高さ(CSS の .you-label::after と同じ) */
const YOU_ARROW_PX = 6;

/** あとから加わったAIが、ふわっと現れる長さ(CSS の avatar-fade と同じ) */
const FADE_IN_MS = 800;

/** ほかの人の跳ね直す間隔のゆらぎ(±15%。大勢がそろって跳ねないように) */
const HOP_JITTER = 0.15;

/**
 * 小人の舞台(見本 05 の上の部分。docs/functional-design.md「10. 小人の舞台」)。
 *
 * 参加者(AIも含む)を入った順に1列に並べ、合図に合わせて跳ねさせる。+1か−1かは見せない。
 * 跳ね方は、だれでも同じ(高さ・時間)。押すたびに最初からやり直すので、連打すると途中で切られてピクピク動く。
 * 自分の小人は、いちばん手前で、頭の上に「あなた」を出し、押したときに跳ねる。
 * ほかの人の1回ごとの押した合図は届かない(強さだけ)ので、強さに合わせた間隔で、跳ね直す。
 */
export class StageView {
  readonly element: HTMLElement;
  private readonly avatars = new Map<string, HTMLElement>();
  private playersKey = '';
  private myAvatar: HTMLElement | null = null;
  private readonly pendingSummons = new Set<string>(); // 小人がまだ並んでいない召喚
  /** ほかの人の、跳ね直すタイマー(id → 間隔とタイマー) */
  private readonly hoppers = new Map<
    string,
    { intervalMs: number; timer: ReturnType<typeof setInterval> }
  >();

  /**
   * @param myId - 自分の id(「あなた」と、押したときに跳ねる)
   * @param onTap - 人間の小人をタップした(実績カード)
   * @param metrics - 舞台の寸法
   */
  constructor(
    private readonly myId: string,
    private readonly onTap: (playerId: string) => void = () => {},
    private readonly metrics: StageMetrics = METRICS
  ) {
    this.element = html(`
<div class="stage">
  <div class="ground"></div>
  <div class="stage-count" data-ref="count"></div>
  <div class="you-label" data-ref="you" hidden><span data-ref="youText"></span></div>
  <div class="stage-people" data-ref="people"></div>
</div>`);
  }

  update(view: RoundView, nowMs: number): void {
    text(
      ref(this.element, 'count'),
      t('play.players', { n: view.players.length })
    );
    text(ref(this.element, 'youText'), t('play.you'));
    this.place(view.players);
    const present = new Set<string>();
    for (const player of view.players) {
      if (player.id === this.myId) {
        continue; // 自分は、押したときに跳ねる(合図を待たない)
      }
      present.add(player.id);
      const jump = jumpFor(view.pulses[player.id] ?? null, nowMs, this.metrics);
      this.setHopping(player.id, jump?.intervalMs ?? null);
    }
    for (const id of this.hoppers.keys()) {
      if (!present.has(id)) {
        this.setHopping(id, null);
      }
    }
  }

  /** タイマーを止める(画面を閉じる) */
  dispose(): void {
    for (const id of [...this.hoppers.keys()]) {
      this.setHopping(id, null);
    }
  }

  /** 自分が押した: 跳ねる(+1か−1かは、数字とポイントで分かるので、文字は出さない) */
  myPress(): void {
    if (this.myAvatar !== null) {
      this.hop(this.myAvatar);
    }
  }

  /**
   * ほかの人の小人を、intervalMs ごとに跳ね直させる。null なら止める(いまの跳ねは最後まで)。
   * 間隔が変わったときだけ、タイマーを作り直す
   */
  private setHopping(id: string, intervalMs: number | null): void {
    const current = this.hoppers.get(id);
    if (current?.intervalMs === intervalMs) {
      return;
    }
    if (current !== undefined) {
      clearInterval(current.timer);
      this.hoppers.delete(id);
    }
    const avatar = this.avatars.get(id);
    if (intervalMs === null || avatar === undefined) {
      return;
    }
    const jitter = 1 + (Math.random() * 2 - 1) * HOP_JITTER;
    this.hop(avatar);
    this.hoppers.set(id, {
      intervalMs,
      timer: setInterval(() => this.hop(avatar), intervalMs * jitter),
    });
  }

  /**
   * 跳ねる動きを、最初からやり直す。同じ動きの2つの名前(hop-a・hop-b)を入れ替えると、
   * 描き直しを待たずに、やり直せる(途中で切られると、ピクピク動く)
   */
  private hop(avatar: HTMLElement): void {
    const next = avatar.classList.contains('hop-a') ? 'hop-b' : 'hop-a';
    avatar.classList.remove('hop-a', 'hop-b');
    avatar.style.setProperty('--h', `${this.metrics.hopHeightPx}px`);
    avatar.style.animationDuration = `${this.metrics.hopDurationMs}ms`;
    avatar.classList.add(next);
  }

  /**
   * 途中参加の人が、光の柱の中を降りてくる(見本 05。約3.5秒で地平線に着く)。
   * 召喚の知らせは、参加者の一覧より先に届くので、まだ並んでいなければ、並べたときに始める
   */
  summon(playerId: string): void {
    const avatar = this.avatars.get(playerId);
    if (avatar === undefined) {
      this.pendingSummons.add(playerId);
      return;
    }
    this.startSummon(avatar);
  }

  private startSummon(avatar: HTMLElement): void {
    const people = ref(this.element, 'people');
    const beam = html('<div class="summon-beam"></div>');
    beam.style.left = `${parseFloat(avatar.style.left) - 6}px`;
    beam.style.bottom = avatar.style.bottom;
    people.append(beam);
    avatar.classList.add('summoning');
    avatar.insertAdjacentHTML(
      'beforeend',
      [
        sparkleSvg(
          '#FFFFFF',
          'left: -14px; top: 2px; width: 10px; height: 10px',
          'spk'
        ),
        sparkleSvg(
          '#FF5C8A',
          'left: 26px; top: -6px; width: 12px; height: 12px; animation-delay: 0.2s',
          'spk'
        ),
        sparkleSvg(
          '#3A86FF',
          'left: -10px; top: 24px; width: 8px; height: 8px; animation-delay: 0.4s',
          'spk'
        ),
        sparkleSvg(
          '#FFFFFF',
          'left: 28px; top: 20px; width: 10px; height: 10px; animation-delay: 0.6s',
          'spk'
        ),
      ].join('')
    );
    // 動きをへらしているときは、動きの終わりが来ないので、時間で片付ける
    setTimeout(() => {
      beam.remove();
      avatar.classList.remove('summoning');
      avatar.querySelectorAll('.spk').forEach((spark) => spark.remove());
    }, SUMMON_MS);
  }

  /**
   * 顔ぶれか見た目(自分がキャラを変えた)が変わったときだけ、並べ直す。あとから加わったAIは、ふわっと現れる
   */
  private place(players: readonly Player[]): void {
    const key = players.map((p) => `${p.id} ${lookOf(p)}`).join('\n');
    if (key === this.playersKey) {
      return;
    }
    const firstTime = this.playersKey === '';
    this.playersKey = key;
    const people = ref(this.element, 'people');
    const stageWidthPx = people.clientWidth || DEFAULT_STAGE_WIDTH;
    const myIndex = players.findIndex((p) => p.id === this.myId);
    const slots = stageLayout(
      {
        count: players.length,
        myIndex: myIndex === -1 ? null : myIndex,
        stageWidthPx,
      },
      this.metrics
    );
    players.forEach((player, i) => {
      let avatar = this.avatars.get(player.id);
      if (avatar === undefined) {
        avatar = html(`<div class="avatar">${this.svgOf(player)}</div>`);
        if (!firstTime && player.kind === 'ai') {
          // 現れ終わったら外す(付けたままだと、跳ねる動きを打ち消す)。動きをへらしているときは終わりが来ないので、時間で
          const fading = avatar;
          fading.classList.add('fade-in');
          setTimeout(() => fading.classList.remove('fade-in'), FADE_IN_MS);
        }
        if (player.kind === 'human') {
          avatar.classList.add('tappable');
          avatar.addEventListener('click', () => this.onTap(player.id));
        }
        avatar.dataset.look = lookOf(player);
        this.avatars.set(player.id, avatar);
        people.append(avatar);
      } else if (avatar.dataset.look !== lookOf(player)) {
        avatar.dataset.look = lookOf(player);
        avatar.querySelector(':scope > svg:not(.spk)')?.remove(); // 召喚のキラキラは残す
        avatar.insertAdjacentHTML('afterbegin', this.svgOf(player));
      }
      const slot = slots[i]!;
      avatar.style.left = `${slot.leftPx}px`;
      avatar.style.bottom = `${slot.bottomPx}px`;
      avatar.style.zIndex = String(slot.zIndex);
      if (this.pendingSummons.delete(player.id)) {
        this.startSummon(avatar);
      }
    });
    const you = ref(this.element, 'you');
    this.myAvatar = myIndex === -1 ? null : this.avatars.get(this.myId)!;
    you.hidden = myIndex === -1;
    if (myIndex !== -1) {
      const slot = slots[myIndex]!;
      you.style.left = `${slot.leftPx + this.metrics.bodyWidthPx / 2}px`;
      // 矢印(6px)の先が、止まっている頭の 1px 上。跳ねたときは、頭が少し重なってよい
      you.style.bottom = `${slot.bottomPx + this.metrics.bodyHeightPx + YOU_ARROW_PX + 1}px`;
    }
  }

  private svgOf(player: Player): string {
    if (player.kind === 'ai') {
      return robotSvg(player.personality);
    }
    return player.character === null
      ? ''
      : playerSvg(player.id, player.character);
  }
}

/** 小人の見た目を表す文字列(変わったかを比べる) */
function lookOf(player: Player): string {
  return JSON.stringify([player.character, player.personality]);
}
