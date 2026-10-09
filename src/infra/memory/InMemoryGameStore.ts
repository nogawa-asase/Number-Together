import type { StatsDelta } from '../../domain/points/types';
import type { Player, Profile, Pulse, Stats } from '../../domain/types';
import type {
  ConnectionState,
  GameStore,
  Presence,
  Unsubscribe,
} from '../store/GameStore';
import { StoreError } from '../store/StoreError';
import type { InMemoryServer } from './InMemoryServer';

/**
 * GameStore のメモリ上の実装(テスト・シミュレーション・Firebase なしの画面の確認用)。
 *
 * 利用者ごとの窓口(Firebase の、端末ごとの接続に当たる)。データとルールの判断は、
 * 全員で共有する InMemoryServer が持つ。1つのサーバーに、窓口を何人分でもつなげる。
 */
export class InMemoryGameStore implements GameStore {
  private uid: string | null = null;
  private online = true;
  private readonly connectionListeners = new Set<
    (state: ConnectionState) => void
  >();

  constructor(private readonly server: InMemoryServer) {}

  // ---- テスト用の操作 ----

  /** 接続を切る。この利用者の参加中の印は、すべての部屋から消える */
  disconnect(): void {
    this.online = false;
    if (this.uid !== null) {
      this.server.dropConnection(this.uid);
    }
    this.emitConnection();
  }

  /** つなぎ直す(部屋には、入り直す必要がある) */
  reconnect(): void {
    this.online = true;
    this.emitConnection();
  }

  private emitConnection(): void {
    const state = this.online ? 'online' : 'offline';
    for (const listener of [...this.connectionListeners]) {
      listener(state);
    }
  }

  /** サインイン済みで、つながっているときの uid(書き込みの前に呼ぶ) */
  private writer(): string {
    const uid = this.reader();
    if (!this.online) {
      throw new StoreError('offline', '接続が切れています');
    }
    return uid;
  }

  /** サインイン済みのときの uid */
  private reader(): string {
    if (this.uid === null) {
      throw new StoreError('notSignedIn', 'サインインしていません');
    }
    return this.uid;
  }

  // ---- 認証・プロフィール ----

  async signIn(): Promise<{ uid: string }> {
    if (!this.online) {
      throw new StoreError('offline', '接続が切れています');
    }
    this.uid ??= this.server.issueUid();
    return { uid: this.uid };
  }

  async loadProfile(uid: string): Promise<Profile | null> {
    this.reader();
    return this.server.loadProfile(uid);
  }

  async saveProfile(uid: string, profile: Profile): Promise<void> {
    this.server.saveProfile(this.writer(), uid, profile);
  }

  async loadStats(uid: string): Promise<Stats> {
    this.reader();
    return this.server.loadStats(uid);
  }

  async applyStats(
    uid: string,
    roundId: string,
    delta: StatsDelta
  ): Promise<void> {
    this.server.applyStats(this.writer(), uid, roundId, delta);
  }

  // ---- 接続 ----

  onConnection(listener: (state: ConnectionState) => void): Unsubscribe {
    this.connectionListeners.add(listener);
    listener(this.online ? 'online' : 'offline');
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  // ---- 部屋 ----

  async readRoomCounts(): Promise<number[]> {
    this.reader();
    return this.server.readRoomCounts();
  }

  async tryEnterRoom(
    roomId: number,
    uid: string,
    capacity: number
  ): Promise<boolean> {
    const caller = this.writer();
    if (uid !== caller) {
      return false; // 参加中の印は、本人だけが書ける
    }
    return this.server.tryEnterRoom(caller, roomId, capacity);
  }

  async createRoom(uid: string): Promise<number> {
    const caller = this.writer();
    if (uid !== caller) {
      throw new StoreError('permissionDenied', '本人だけが部屋を作れます');
    }
    return this.server.createRoom(caller);
  }

  async leaveRoom(roomId: number, uid: string): Promise<void> {
    const caller = this.writer();
    if (uid === caller) {
      this.server.leaveRoom(caller, roomId);
    }
  }

  onPresence(
    roomId: number,
    listener: (members: Readonly<Record<string, Presence>>) => void
  ): Unsubscribe {
    this.reader();
    return this.server.subscribe(`presence:${roomId}`, () =>
      listener(this.server.presenceOf(roomId))
    );
  }

  async claimAiHost(
    roomId: number,
    _roundId: string,
    uid: string
  ): Promise<boolean> {
    const caller = this.writer();
    if (uid !== caller) {
      return false; // 書ける値は、自分の uid だけ
    }
    return this.server.claimAiHost(caller, roomId);
  }

  onAiHost(
    roomId: number,
    listener: (uid: string | null) => void
  ): Unsubscribe {
    this.reader();
    return this.server.subscribe(`aiHost:${roomId}`, () =>
      listener(this.server.aiHostOf(roomId))
    );
  }

  // ---- 回 ----

  async addPlayer(
    roomId: number,
    roundId: string,
    player: Player
  ): Promise<void> {
    this.server.addPlayer(this.writer(), roomId, roundId, player);
  }

  onPlayers(
    roomId: number,
    roundId: string,
    listener: (players: Player[]) => void
  ): Unsubscribe {
    this.reader();
    return this.server.subscribe(`players:${roomId}:${roundId}`, () =>
      listener(this.server.playersOf(roomId, roundId))
    );
  }

  async addToNumber(
    roomId: number,
    roundId: string,
    delta: number
  ): Promise<void> {
    this.server.addToNumber(this.writer(), roomId, roundId, delta);
  }

  onNumber(
    roomId: number,
    roundId: string,
    listener: (n: number) => void
  ): Unsubscribe {
    this.reader();
    return this.server.subscribe(`number:${roomId}:${roundId}`, () =>
      listener(this.server.numberOf(roomId, roundId))
    );
  }

  async sendPulse(
    roomId: number,
    roundId: string,
    playerId: string,
    power: number
  ): Promise<void> {
    this.server.sendPulse(this.writer(), roomId, roundId, playerId, power);
  }

  onPulses(
    roomId: number,
    roundId: string,
    listener: (pulses: Readonly<Record<string, Pulse>>) => void
  ): Unsubscribe {
    this.reader();
    return this.server.subscribe(`pulses:${roomId}:${roundId}`, () =>
      listener(this.server.pulsesOf(roomId, roundId))
    );
  }

  async writePoints(
    roomId: number,
    roundId: string,
    playerId: string,
    points: number
  ): Promise<void> {
    this.server.writePoints(this.writer(), roomId, roundId, playerId, points);
  }

  async readPoints(
    roomId: number,
    roundId: string
  ): Promise<Record<string, number>> {
    return this.server.readPoints(this.reader(), roomId, roundId);
  }

  async deleteRound(roomId: number, roundId: string): Promise<void> {
    this.server.deleteRound(this.writer(), roomId, roundId);
  }
}
