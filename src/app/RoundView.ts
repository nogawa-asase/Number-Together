import type { GraphSample } from '../domain/layout/graphGeometry';
import type { PressKind } from '../domain/points/types';
import type { RankingView } from '../domain/ranking/types';
import type { RoundClock } from '../domain/schedule/types';
import type { Outcome, Player, Pulse } from '../domain/types';

/** 結果発表に出すもの */
export interface ResultView {
  readonly outcome: Outcome;
  readonly missBy: number | null;
  readonly finalNumber: number;
  readonly target: number;
  readonly myPoints: number; // 貯めたポイント(失敗のときも、見せる)
  readonly awarded: number; // 報酬ポイント
  readonly ranking: RankingView;
}

/** 画面に出す、まとめた状態(docs/functional-design.md「RoundView」) */
export interface RoundView {
  readonly roomId: number;
  readonly roundId: string;
  readonly clock: RoundClock; // 組み立てた時刻の回の時計
  readonly number: number; // サーバーの値 + まだ送っていない自分の分
  readonly players: readonly Player[]; // 入った順
  readonly playerCount: number; // 集合中は displayPlayerCount、それ以外は players の数
  readonly target: number;
  readonly lower: number;
  readonly upper: number;
  readonly inRange: boolean;
  readonly myPoints: number;
  readonly bonusActive: boolean;
  readonly pulses: Readonly<Record<string, Pulse>>;
  readonly samples: readonly GraphSample[]; // グラフの標本(時刻の順)
  readonly result: ResultView | null; // 終了の pointsGraceMs 後から
}

/** 合図の種類(画面の見本 04・07・08・09) */
export type Cue = 'start' | 'x3' | 'tenSeconds' | 'end';

/** 一度だけの出来事(演出に使う) */
export type RoundEvent =
  | { readonly kind: 'cue'; readonly cue: Cue }
  | {
      readonly kind: 'summon'; // ゲーム中に人間が加わった(目標UP!と、降りてくる演出)
      readonly player: Player;
      readonly targetFrom: number;
      readonly targetTo: number;
    }
  | { readonly kind: 'fadeIn'; readonly player: Player } // AIが加わった
  | {
      readonly kind: 'myPress';
      readonly press: PressKind;
      readonly gain: number;
    };
