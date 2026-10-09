import type { RoundView } from '../../app/RoundView';

/** 部屋の中の画面(集合中・プレイ中)。RoomScreen が、段階で出し分ける */
export interface RoomPart {
  readonly element: HTMLElement;
  /** view が変わった、または時間が進んだ(nowMs はサーバー時刻) */
  update(view: RoundView, nowMs: number): void;
  dispose(): void;
}
