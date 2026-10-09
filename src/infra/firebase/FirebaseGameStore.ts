import { signInAnonymously } from 'firebase/auth';
import {
  get,
  increment,
  type OnDisconnect,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import type { GameConfig } from '../../domain/config/types';
import type { StatsDelta } from '../../domain/points/types';
import type { Player, Profile, Pulse, Stats } from '../../domain/types';
import type {
  ConnectionState,
  GameStore,
  Presence,
  Unsubscribe,
} from '../store/GameStore';
import { StoreError } from '../store/StoreError';
import { isPermissionDenied, toStoreError } from './errors';
import type { FirebaseHandles } from './firebaseApp';
import {
  parseNumber,
  parsePlayers,
  parsePoints,
  parsePresence,
  parseProfile,
  parsePulses,
  parseStats,
  parseUid,
} from './parse';
import { paths } from './paths';
import { NO_TRAFFIC_METER, type TrafficMeter } from './TrafficMeter';

/**
 * GameStore の Firebase の実装(docs/functional-design.md「GameStore」、docs/architecture.md「Firebase の構成」)。
 *
 * - 共有の数字は increment で加算する(読んで足して書き戻さない)
 * - 入室は memberCount のトランザクション(条件付きの書き込み)。参加中の印は onDisconnect で消し、人数も1減らす
 * - ルールに拒否された書き込みは、例外にしない(画面は、購読した値に合わせる)。読み取りの拒否は StoreError
 * - firebase/* の例外は、StoreError に変えてから上に伝える
 * - 読んだ値は、parse.ts で検証してから渡す(他の人が書いた値は、信用しない)
 */
export class FirebaseGameStore implements GameStore {
  /** 部屋ごとの、切断したときの予約(退出のときに取り消す) */
  private readonly disconnects = new Map<number, OnDisconnect[]>();

  constructor(
    private readonly fb: FirebaseHandles,
    private readonly config: GameConfig,
    private readonly meter: TrafficMeter = NO_TRAFFIC_METER
  ) {}

  // ---- 内部の補助 ----

  /** サインイン済みの uid。サインインの前は StoreError('notSignedIn') */
  private caller(): string {
    const user = this.fb.auth.currentUser;
    if (user === null) {
      throw new StoreError('notSignedIn', 'サインインしていません');
    }
    return user.uid;
  }

  private ref(path: string) {
    return ref(this.fb.db, path);
  }

  /** 1回読む。拒否・切断などは StoreError */
  private async read(path: string, action: string): Promise<unknown> {
    this.caller();
    try {
      const value: unknown = (await get(this.ref(path))).val();
      this.meter.countIn(path, value);
      return value;
    } catch (error) {
      throw toStoreError(error, action);
    }
  }

  /**
   * 書く。ルールに拒否されたら false(例外にしない)。それ以外の失敗は StoreError
   *
   * @param write - 書き込み(Firebase の約束)
   */
  private async write(
    action: string,
    path: string,
    value: unknown,
    write: () => Promise<unknown>
  ): Promise<boolean> {
    this.caller();
    this.meter.countOut(path, value);
    try {
      await write();
      return true;
    } catch (error) {
      if (isPermissionDenied(error)) {
        console.debug(`書き込みが拒否されました(${action}):`, path);
        return false;
      }
      throw toStoreError(error, action);
    }
  }

  /** 購読する。届いた値は、parse で検証してから渡す */
  private watch<T>(
    path: string,
    parse: (raw: unknown) => T,
    listener: (value: T) => void
  ): Unsubscribe {
    this.caller();
    return onValue(
      this.ref(path),
      (snapshot) => {
        const value: unknown = snapshot.val();
        this.meter.countIn(path, value);
        listener(parse(value));
      },
      (error) => {
        console.warn(`購読が止まりました: ${path}`, error);
      }
    );
  }

  // ---- 認証・プロフィール ----

  async signIn(): Promise<{ uid: string }> {
    const { auth } = this.fb;
    try {
      await auth.authStateReady(); // 覚えている ID を読み終えるのを待つ
      const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
      return { uid: user.uid };
    } catch (error) {
      throw toStoreError(error, 'サインイン');
    }
  }

  async loadProfile(uid: string): Promise<Profile | null> {
    return parseProfile(
      await this.read(paths.profile(uid), 'プロフィールの読み込み')
    );
  }

  async saveProfile(uid: string, profile: Profile): Promise<void> {
    const path = paths.profile(uid);
    await this.write('プロフィールの保存', path, profile, () =>
      set(this.ref(path), profile)
    );
  }

  async loadStats(uid: string): Promise<Stats> {
    return parseStats(await this.read(paths.stats(uid), '実績の読み込み'));
  }

  async applyStats(
    uid: string,
    roundId: string,
    delta: StatsDelta
  ): Promise<void> {
    const path = paths.stats(uid);
    await this.write('実績の保存', path, delta, () =>
      runTransaction(this.ref(path), (raw: unknown) => {
        const current = parseStats(raw);
        if (current.lastCountedRound === roundId) {
          return undefined; // 同じ回は、二重に数えない(書かずに終える)
        }
        return {
          plays: current.plays + delta.plays,
          successes: current.successes + delta.successes,
          perfects: current.perfects + delta.perfects,
          totalPoints: current.totalPoints + delta.totalPoints,
          lastCountedRound: roundId,
        };
      })
    );
  }

  // ---- 接続 ----

  onConnection(listener: (state: ConnectionState) => void): Unsubscribe {
    return onValue(this.ref(paths.connected()), (snapshot) => {
      listener(snapshot.val() === true ? 'online' : 'offline');
    });
  }

  // ---- 部屋 ----

  async readRoomCounts(): Promise<number[]> {
    const count = Math.max(
      0,
      parseNumber(await this.read(paths.roomCount(), '部屋の数の読み込み'))
    );
    return Promise.all(
      Array.from({ length: count }, async (_, i) =>
        Math.max(
          0,
          parseNumber(
            await this.read(paths.memberCount(i + 1), '部屋の人数の読み込み')
          )
        )
      )
    );
  }

  async tryEnterRoom(
    roomId: number,
    uid: string,
    capacity: number
  ): Promise<boolean> {
    const caller = this.caller();
    if (uid !== caller) {
      return false; // 参加中の印は、本人だけが書ける
    }
    if ((await this.read(paths.presenceOf(roomId, caller), '入室')) !== null) {
      return true; // すでに入っている
    }
    const limit = Math.min(capacity, this.config.roomCapacity);
    const path = paths.memberCount(roomId);
    this.meter.countOut(path, 1);
    try {
      const result = await runTransaction(this.ref(path), (raw: unknown) => {
        const count = typeof raw === 'number' ? raw : 0;
        return count < limit ? count + 1 : undefined; // 満員なら、書かずに終える
      });
      if (!result.committed) {
        return false;
      }
    } catch (error) {
      if (isPermissionDenied(error)) {
        return false;
      }
      throw toStoreError(error, '入室');
    }
    await this.arrive(roomId, caller);
    return true;
  }

  /** 参加中の印を書き、切断したら印を消して人数を1減らす予約をする */
  private async arrive(roomId: number, uid: string): Promise<void> {
    const presence = this.ref(paths.presenceOf(roomId, uid));
    const leavePresence = onDisconnect(presence);
    const leaveCount = onDisconnect(this.ref(paths.memberCount(roomId)));
    try {
      await leavePresence.remove();
      await leaveCount.set(increment(-1));
      this.disconnects.set(roomId, [leavePresence, leaveCount]);
      const value = { joinedAt: serverTimestamp() };
      this.meter.countOut(paths.presenceOf(roomId, uid), value);
      await set(presence, value);
    } catch (error) {
      throw toStoreError(error, '入室');
    }
  }

  async createRoom(uid: string): Promise<number> {
    const caller = this.caller();
    if (uid !== caller) {
      throw new StoreError('permissionDenied', '本人だけが部屋を作れます');
    }
    let roomId: number;
    try {
      const result = await runTransaction(
        this.ref(paths.roomCount()),
        (raw: unknown) => (typeof raw === 'number' ? raw : 0) + 1
      );
      roomId = parseNumber(result.snapshot.val());
    } catch (error) {
      throw toStoreError(error, '部屋の作成');
    }
    this.meter.countOut(paths.roomCount(), roomId);
    await this.tryEnterRoom(roomId, caller, this.config.roomCapacity);
    return roomId;
  }

  async leaveRoom(roomId: number, uid: string): Promise<void> {
    const caller = this.caller();
    if (uid !== caller) {
      return;
    }
    const pending = this.disconnects.get(roomId) ?? [];
    this.disconnects.delete(roomId);
    const presencePath = paths.presenceOf(roomId, caller);
    try {
      await Promise.all(pending.map((handler) => handler.cancel()));
      if ((await get(this.ref(presencePath))).exists()) {
        await remove(this.ref(presencePath));
        await set(this.ref(paths.memberCount(roomId)), increment(-1));
      }
    } catch (error) {
      if (!isPermissionDenied(error)) {
        throw toStoreError(error, '退出');
      }
    }
  }

  onPresence(
    roomId: number,
    listener: (members: Readonly<Record<string, Presence>>) => void
  ): Unsubscribe {
    return this.watch(paths.presence(roomId), parsePresence, listener);
  }

  async claimAiHost(
    roomId: number,
    _roundId: string,
    uid: string
  ): Promise<boolean> {
    const caller = this.caller();
    if (uid !== caller) {
      return false; // 書ける値は、自分の uid だけ
    }
    const current = parseUid(
      await this.read(paths.aiHost(roomId), 'AI担当の読み込み')
    );
    if (current === caller) {
      // もう担当。部屋にいれば、そのまま(ルールでは、いる担当を上書きできないので、先に確かめる)
      const present = await this.read(
        paths.presenceOf(roomId, caller),
        'AI担当の読み込み'
      );
      if (present !== null) {
        return true;
      }
    }
    const path = paths.aiHost(roomId);
    return this.write('AI担当', path, caller, () =>
      set(this.ref(path), caller)
    );
  }

  onAiHost(
    roomId: number,
    listener: (uid: string | null) => void
  ): Unsubscribe {
    return this.watch(paths.aiHost(roomId), parseUid, listener);
  }

  // ---- 回 ----

  async addPlayer(
    roomId: number,
    roundId: string,
    player: Player
  ): Promise<void> {
    const path = paths.player(roomId, roundId, player.id);
    // null の項目は書かない(データベースでは、null は「ない」)。joinedAt はサーバー時刻
    const value = {
      id: player.id,
      kind: player.kind,
      name: player.name,
      joinedAt: serverTimestamp(),
      joinedDuring: player.joinedDuring,
      ...(player.uid === null ? {} : { uid: player.uid }),
      ...(player.character === null ? {} : { character: player.character }),
      ...(player.personality === null
        ? {}
        : { personality: player.personality }),
    };
    await this.write('参加者の追加', path, value, () =>
      set(this.ref(path), value)
    );
  }

  onPlayers(
    roomId: number,
    roundId: string,
    listener: (players: Player[]) => void
  ): Unsubscribe {
    return this.watch(paths.players(roomId, roundId), parsePlayers, listener);
  }

  async addToNumber(
    roomId: number,
    roundId: string,
    delta: number
  ): Promise<void> {
    const path = paths.number(roomId, roundId);
    await this.write('数字の加算', path, delta, () =>
      update(ref(this.fb.db), { [path]: increment(delta) })
    );
  }

  onNumber(
    roomId: number,
    roundId: string,
    listener: (n: number) => void
  ): Unsubscribe {
    return this.watch(paths.number(roomId, roundId), parseNumber, listener);
  }

  async sendPulse(
    roomId: number,
    roundId: string,
    playerId: string,
    power: number
  ): Promise<void> {
    const path = paths.pulse(roomId, roundId, playerId);
    const value = { t: serverTimestamp(), power };
    await this.write('合図', path, value, () => set(this.ref(path), value));
  }

  onPulses(
    roomId: number,
    roundId: string,
    listener: (pulses: Readonly<Record<string, Pulse>>) => void
  ): Unsubscribe {
    return this.watch(paths.pulses(roomId, roundId), parsePulses, listener);
  }

  async writePoints(
    roomId: number,
    roundId: string,
    playerId: string,
    points: number
  ): Promise<void> {
    const path = paths.points(roomId, roundId, playerId);
    await this.write('ポイントの保存', path, points, () =>
      set(this.ref(path), points)
    );
  }

  /**
   * 読める分のポイント。ポイントは、人ごとにしか読めない(ルール)ので、参加者ごとに読む。
   * 他の人の分は、ゲーム終了の猶予のあとだけ読める(猶予の前は、拒否されるので、入れない)
   */
  async readPoints(
    roomId: number,
    roundId: string
  ): Promise<Record<string, number>> {
    const players = parsePlayers(
      await this.read(paths.players(roomId, roundId), 'ポイントの読み込み')
    );
    const entries = await Promise.all(
      players.map(async (player): Promise<[string, number] | null> => {
        const path = paths.points(roomId, roundId, player.id);
        try {
          const value = parsePoints(
            await this.read(path, 'ポイントの読み込み')
          );
          return value === null ? null : [player.id, value];
        } catch (error) {
          if (
            error instanceof StoreError &&
            error.kind === 'permissionDenied'
          ) {
            return null; // まだ読めない(他の人の分は、猶予のあとから)
          }
          throw error;
        }
      })
    );
    return Object.fromEntries(
      entries.filter((entry): entry is [string, number] => entry !== null)
    );
  }

  async deleteRound(roomId: number, roundId: string): Promise<void> {
    const path = paths.round(roomId, roundId);
    await this.write('古い回の削除', path, null, () => remove(this.ref(path)));
  }
}
