import type { StatsDelta } from '../../domain/points/types';
import type { Player, Profile, Pulse, Stats } from '../../domain/types';

/** 購読を解除する関数 */
export type Unsubscribe = () => void;

/** 部屋の参加中の印 */
export interface Presence {
  readonly joinedAt: number; // 部屋に入ったサーバー時刻(AI担当を引き継ぐ順に使う)
}

/** 接続の状態 */
export type ConnectionState = 'online' | 'offline';

/**
 * データの読み書き(docs/functional-design.md「GameStore」)。
 *
 * Firebase とのやりとりを、実装(FirebaseGameStore・InMemoryGameStore)の中に閉じ込める。
 * アプリケーション層は、このインターフェースだけを使う。
 *
 * - ルールに拒否された書き込みは、例外にしない(画面は、購読した値に合わせる)。
 *   条件付きの書き込み(tryEnterRoom・claimAiHost)は、false を返す
 * - サインインの前の呼び出しは StoreError('notSignedIn')、接続が切れている間の書き込みは StoreError('offline')
 * - 購読は、登録したときに今の値を1回知らせ、変わるたびに知らせる。解除する関数を、必ず保持して呼ぶ
 */
export interface GameStore {
  // 認証・プロフィール
  signIn(): Promise<{ uid: string }>;
  loadProfile(uid: string): Promise<Profile | null>;
  saveProfile(uid: string, profile: Profile): Promise<void>;
  loadStats(uid: string): Promise<Stats>;
  /** 実績に足す。同じ回は、二重に数えない(lastCountedRound) */
  applyStats(uid: string, roundId: string, delta: StatsDelta): Promise<void>;

  // 接続
  onConnection(listener: (state: ConnectionState) => void): Unsubscribe;

  // 部屋
  /** 部屋ごとの人間の人数。[i] は部屋 i + 1 */
  readRoomCounts(): Promise<number[]>;
  /** 条件付きの書き込みで、部屋に入る。満員・入れなければ false */
  tryEnterRoom(roomId: number, uid: string, capacity: number): Promise<boolean>;
  /** 新しい部屋を作って入る(集合中だけ呼ぶ)。作った部屋の番号を返す */
  createRoom(uid: string): Promise<number>;
  /** 部屋を出る。接続が切れたときも、自動で出る */
  leaveRoom(roomId: number, uid: string): Promise<void>;
  onPresence(
    roomId: number,
    listener: (members: Readonly<Record<string, Presence>>) => void
  ): Unsubscribe;
  /** AI担当になる。担当が空、または、いまの担当が部屋にいないときだけ成功する */
  claimAiHost(roomId: number, roundId: string, uid: string): Promise<boolean>;
  onAiHost(roomId: number, listener: (uid: string | null) => void): Unsubscribe;

  // 回
  /** 参加者を足す(追加だけ)。joinedAt は、サーバー時刻になる */
  addPlayer(roomId: number, roundId: string, player: Player): Promise<void>;
  onPlayers(
    roomId: number,
    roundId: string,
    listener: (players: Player[]) => void
  ): Unsubscribe;
  /** サーバー側で加算する。|delta| ≤ maxDeltaPerWrite */
  addToNumber(roomId: number, roundId: string, delta: number): Promise<void>;
  onNumber(
    roomId: number,
    roundId: string,
    listener: (n: number) => void
  ): Unsubscribe;
  sendPulse(
    roomId: number,
    roundId: string,
    playerId: string,
    power: number
  ): Promise<void>;
  onPulses(
    roomId: number,
    roundId: string,
    listener: (pulses: Readonly<Record<string, Pulse>>) => void
  ): Unsubscribe;
  writePoints(
    roomId: number,
    roundId: string,
    playerId: string,
    points: number
  ): Promise<void>;
  /** 読める分のポイント。他の人の分は、ゲーム終了の3秒後から読める */
  readPoints(roomId: number, roundId: string): Promise<Record<string, number>>;
  /** 古い回のデータを消す(AI担当だけ) */
  deleteRound(roomId: number, roundId: string): Promise<void>;
}
