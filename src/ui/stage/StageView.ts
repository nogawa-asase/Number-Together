import { t } from '../../app/i18n/i18n';
import type { RoundView } from '../../app/RoundView';
import type { PressKind } from '../../domain/points/types';
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

/** 自分が押したときの跳ね方(押し方の強さ 2 と同じ) */
const MY_JUMP = { heightPx: 20, durationMs: 600 };

/**
 * 小人の舞台(見本 05 の上の部分。docs/functional-design.md「10. 小人の舞台」)。
 *
 * 参加者(AIも含む)を入った順に1列に並べ、合図に合わせて跳ねさせる。+1か−1かは見せない。
 * 自分の小人は、いちばん手前で、頭の上に「あなた」を出し、押したときに跳ねて「+1」を浮かべる。
 */
export class StageView {
  readonly element: HTMLElement;
  private readonly avatars = new Map<string, HTMLElement>();
  private playersKey = '';
  private myAvatar: HTMLElement | null = null;
  private readonly pendingSummons = new Set<string>(); // 小人がまだ並んでいない召喚

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
    for (const player of view.players) {
      if (player.id === this.myId) {
        continue; // 自分は、押したときに跳ねる(合図を待たない)
      }
      const avatar = this.avatars.get(player.id)!;
      const jump = jumpFor(view.pulses[player.id] ?? null, nowMs, this.metrics);
      avatar.classList.toggle('act', jump !== null);
      if (jump !== null) {
        avatar.style.setProperty('--h', `${jump.heightPx}px`);
        avatar.style.animationDuration = `${jump.durationMs}ms`;
      }
    }
  }

  /** 自分が押した: 跳ねて、頭の横に「+1」(「−1」)を浮かべる */
  myPress(kind: PressKind): void {
    const avatar = this.myAvatar;
    if (avatar === null) {
      return;
    }
    avatar.classList.remove('hop-once');
    void avatar.offsetWidth; // 動きを最初から始め直す
    avatar.style.setProperty('--h', `${MY_JUMP.heightPx}px`);
    avatar.style.animationDuration = `${MY_JUMP.durationMs}ms`;
    avatar.classList.add('hop-once');

    const floater = html('<div class="press-floater"></div>');
    text(floater, kind === '+1' ? '+1' : '−1');
    floater.style.left = `${parseFloat(avatar.style.left) + 25}px`;
    floater.addEventListener('animationend', () => floater.remove());
    ref(this.element, 'people').append(floater);
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

  /** 顔ぶれが変わったときだけ、並べ直す。あとから加わったAIは、ふわっと現れる */
  private place(players: readonly Player[]): void {
    const key = players.map((p) => p.id).join('\n');
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
          avatar.classList.add('fade-in');
        }
        if (player.kind === 'human') {
          avatar.classList.add('tappable');
          avatar.addEventListener('click', () => this.onTap(player.id));
        }
        this.avatars.set(player.id, avatar);
        people.append(avatar);
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
      you.style.left = `${slots[myIndex]!.leftPx + this.metrics.bodyWidthPx / 2}px`;
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
