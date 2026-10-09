import type { PressKind } from '../domain/points/types';
import type { Stats } from '../domain/types';
import type { Unsubscribe } from '../infra/store/GameStore';
import { StoreError } from '../infra/store/StoreError';
import { ActiveRound, type RoundDeps } from './ActiveRound';
import type { RoundEvent, RoundView } from './RoundView';
import type { SessionState } from './SessionController';

export type { RoundDeps } from './ActiveRound';
export type { Cue, ResultView, RoundEvent, RoundView } from './RoundView';

/** SessionController のうち、RoundController が使う部分 */
export interface SessionSource {
  onState(listener: (state: SessionState) => void): Unsubscribe;
  uid(): string | null;
}

/**
 * 回の進行(docs/functional-design.md「RoundController」)。画面は持たず、
 * RoundView と出来事(RoundEvent)を知らせる。
 *
 * - セッションが部屋にいるあいだ、いまの回の数字・参加者・合図を購読し、RoundView を組み立てる
 * - 時刻に合わせて、合図(3・2・1、×3タイム、10秒前、終了)を出す。時刻が飛んだら、組み直す
 * - 押された操作を、pointsForPress と PressBatcher に渡す
 * - 終了の pointsGraceMs 後に、結果を出し、実績を保存する
 */
export class RoundController {
  private readonly viewListeners = new Set<(view: RoundView | null) => void>();
  private readonly eventListeners = new Set<(event: RoundEvent) => void>();
  private readonly unsubscribes: Unsubscribe[] = [];
  private active: ActiveRound | null = null;
  private online = true;

  constructor(
    private readonly deps: RoundDeps,
    private readonly session: SessionSource
  ) {}

  start(): void {
    if (this.unsubscribes.length > 0) {
      return;
    }
    const { store, clock } = this.deps;
    this.unsubscribes.push(
      store.onConnection((state) => {
        this.online = state === 'online';
      }),
      clock.onOffsetChange(() => this.active?.rearm()),
      this.session.onState((state) => this.follow(state))
    );
  }

  stop(): void {
    for (const unsubscribe of this.unsubscribes.splice(0)) {
      unsubscribe();
    }
    this.close();
  }

  /** +1・−1が押された。ゲーム中で、つながっているときだけ受け付ける */
  press(kind: PressKind): void {
    if (this.online) {
      this.active?.press(kind);
    }
  }

  /**
   * 参加者の実績(実績カード)。読めなければ null。
   * 他の人の実績は、誰でも読める(docs/functional-design.md「データベースの配置」)
   */
  async statsOf(playerId: string): Promise<Stats | null> {
    try {
      return await this.deps.store.loadStats(playerId);
    } catch (error) {
      if (!(error instanceof StoreError)) {
        this.deps.onError(error);
      }
      return null;
    }
  }

  /** view が変わったら知らせる。部屋にいないときは null。登録したときにも1回知らせる */
  onView(listener: (view: RoundView | null) => void): Unsubscribe {
    this.viewListeners.add(listener);
    listener(this.active?.view() ?? null);
    return () => {
      this.viewListeners.delete(listener);
    };
  }

  onEvent(listener: (event: RoundEvent) => void): Unsubscribe {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private follow(state: SessionState): void {
    if (state.kind !== 'inRoom') {
      this.close();
      return;
    }
    const { active } = this;
    if (active?.roomId === state.roomId && active.roundId === state.roundId) {
      return;
    }
    this.close();
    this.active = new ActiveRound(
      this.deps,
      state.roomId,
      state.roundId,
      this.session.uid()!,
      {
        view: (view) => this.emitView(view),
        event: (event) => this.emitEvent(event),
      }
    );
    this.emitView(this.active.view());
  }

  private close(): void {
    if (this.active === null) {
      return;
    }
    this.active.close();
    this.active = null;
    this.emitView(null);
  }

  private emitView(view: RoundView | null): void {
    for (const listener of [...this.viewListeners]) {
      listener(view);
    }
  }

  private emitEvent(event: RoundEvent): void {
    for (const listener of [...this.eventListeners]) {
      listener(event);
    }
  }
}
