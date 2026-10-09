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
import { playerSvg } from './characterSvg';
import { robotSvg } from './robotSvg';

/** 舞台の内側の幅の既定(390px の画面。測れないとき) */
const DEFAULT_STAGE_WIDTH = 308;

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

  constructor(
    private readonly myId: string,
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
        this.avatars.set(player.id, avatar);
        people.append(avatar);
      }
      const slot = slots[i]!;
      avatar.style.left = `${slot.leftPx}px`;
      avatar.style.bottom = `${slot.bottomPx}px`;
      avatar.style.zIndex = String(slot.zIndex);
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
