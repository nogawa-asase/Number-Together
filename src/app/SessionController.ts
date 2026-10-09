import type { GameConfig } from '../domain/config/types';
import { type NameVerdict, validateName } from '../domain/names/validateName';
import { planRoom } from '../domain/rooms/planRoom';
import { canJoinNow } from '../domain/schedule/canJoinNow';
import { roundClockAt, roundId } from '../domain/schedule/roundClockAt';
import type { CharacterSpec, Player, Profile, Stats } from '../domain/types';
import type {
  ConnectionState,
  GameStore,
  Presence,
  Unsubscribe,
} from '../infra/store/GameStore';
import type { Cancel, Scheduler } from '../infra/store/Scheduler';
import type { ServerClock } from '../infra/store/ServerClock';
import { StoreError } from '../infra/store/StoreError';

/** 待機の理由 */
export type WaitReason = 'full' | 'lastMinute' | 'afterOffline';

/** いまの状態(画面の切り替えに使う) */
export type SessionState =
  | { readonly kind: 'connecting' } // 起動中
  | { readonly kind: 'busy'; readonly attempts: number } // 混雑中(端末はオンラインなのに、つながらない)
  | { readonly kind: 'offline'; readonly attempts: number } // 起動時に、端末がオフライン
  | { readonly kind: 'needsProfile' } // 初回の登録を待つ
  | { readonly kind: 'entering' } // 部屋を決めている
  | {
      readonly kind: 'waiting';
      readonly reason: WaitReason;
      readonly until: number; // この時刻(次の回の集合の始め)に、もう一度入室を試す
    }
  | {
      readonly kind: 'inRoom';
      readonly roomId: number;
      readonly roundId: string;
      readonly joinedDuring: Player['joinedDuring'];
    }
  | {
      readonly kind: 'reconnecting'; // 部屋にいるあいだに切れた
      readonly roomId: number;
      readonly attempts: number;
    };

/** AiHost のうち、SessionController が使う部分 */
export interface AiHostHandle {
  start(): void;
  stop(): void;
}

/** SessionController が使う部品 */
export interface SessionDeps {
  readonly store: GameStore;
  readonly clock: ServerClock;
  readonly scheduler: Scheduler;
  readonly config: GameConfig;
  /** 端末がオンラインか(ブラウザでは navigator.onLine) */
  readonly deviceOnline: () => boolean;
  /** 部屋に入ったときに、その部屋の AiHost を作る */
  readonly createAiHost: (seat: {
    roomId: number;
    uid: string;
  }) => AiHostHandle;
  /** 想定外のエラー(StoreError 以外)を、上に伝える */
  readonly onError: (error: unknown) => void;
}

/** 部屋を離れたときに覚えておくこと(再接続で、続きから参加するため) */
interface LostRoom {
  readonly roomId: number;
  readonly offlineAt: number;
}

/**
 * 参加・部屋・接続(docs/functional-design.md「SessionController」「12. 接続の状態」)。
 *
 * - 起動: サインインし、プロフィールと実績を読む。つながらなければ、混雑中(またはオフライン)にし、自動で試す
 * - 初回の登録(register)のあと、または2回目以降は、すぐ入室する(planRoom → tryEnterRoom / createRoom / 待機)
 * - 部屋にいるあいだ: 回ごとに参加者になり、AI担当がいなければ取りにいき、AiHost を動かす
 * - 部屋にいるあいだに切れたら、再接続中にし、つながったら、続きから(または次の回から)参加する
 */
export class SessionController {
  private current: SessionState = { kind: 'connecting' };
  private readonly listeners = new Set<(state: SessionState) => void>();
  private myUid: string | null = null;
  private myProfile: Profile | null = null;
  private myStats: Stats | null = null;

  private started = false;
  private stopped = false;
  private connecting = false; // connect の途中
  private connected = false; // サインインと読み込みが済んだ
  private attempts = 0; // 起動時・再接続中に、試した回数
  private unsubscribeConnection: Unsubscribe | null = null;
  private connectTimers: Cancel[] = [];
  private offlineTimers: Cancel[] = [];
  private cancelWait: Cancel | null = null;

  private room: RoomSeat | null = null;
  private lost: LostRoom | null = null;
  private joined: {
    roomId: number;
    roundId: string;
    joinedDuring: Player['joinedDuring'];
  } | null = null; // 最後に参加者になった回

  constructor(private readonly deps: SessionDeps) {}

  // ---- 外から見えるもの ----

  state(): SessionState {
    return this.current;
  }

  /** 状態が変わったら知らせる。登録したときにも1回知らせる */
  onState(listener: (state: SessionState) => void): Unsubscribe {
    this.listeners.add(listener);
    listener(this.current);
    return () => {
      this.listeners.delete(listener);
    };
  }

  uid(): string | null {
    return this.myUid;
  }

  profile(): Profile | null {
    return this.myProfile;
  }

  /** 実績。読み込みに失敗したら null(カードは、名前と称号だけ出す) */
  stats(): Stats | null {
    return this.myStats;
  }

  private setState(state: SessionState): void {
    this.current = state;
    for (const listener of [...this.listeners]) {
      listener(state);
    }
  }

  // ---- 起動 ----

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const { store, scheduler, config } = this.deps;
    this.unsubscribeConnection = store.onConnection((state) =>
      this.handleConnection(state)
    );
    this.connectTimers.push(
      scheduler.after(config.initialConnectTimeoutMs, () => {
        this.showConnectProblem();
        this.connectTimers.push(
          scheduler.every(config.retryMs, () => this.retryNow())
        );
      })
    );
    void this.connect();
  }

  /** 混雑中・オフラインの「いますぐ、ためす」。自動で試すときも、これを呼ぶ */
  retryNow(): void {
    if (this.connected || this.stopped) {
      return;
    }
    this.attempts += 1;
    this.showConnectProblem();
    void this.connect();
  }

  private showConnectProblem(): void {
    const kind = this.deps.deviceOnline() ? 'busy' : 'offline';
    this.setState({ kind, attempts: this.attempts });
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.connected) {
      return;
    }
    this.connecting = true;
    try {
      const { store } = this.deps;
      const { uid } = await store.signIn();
      const profile = await store.loadProfile(uid);
      const stats = await store.loadStats(uid).catch(() => null);
      if (this.stopped) {
        return;
      }
      this.myUid = uid;
      this.myProfile = profile;
      this.myStats = stats;
      this.connected = true;
      this.attempts = 0;
      cancelAll(this.connectTimers);
      if (profile === null) {
        this.setState({ kind: 'needsProfile' });
      } else {
        void this.enterRoom();
      }
    } catch (error) {
      this.report(error); // 切断などは、次の試しを待つ
    } finally {
      this.connecting = false;
    }
  }

  // ---- 初回の登録 ----

  /**
   * 名前とキャラクターを登録して、入室に進む。
   *
   * @returns 名前の検証の結果。使えない名前なら、保存しない
   * @throws Error - サインインの前に呼んだとき
   * @throws StoreError - 保存に失敗したとき(画面で、もう一度押してもらう)
   */
  async register(name: string, character: CharacterSpec): Promise<NameVerdict> {
    const uid = this.myUid;
    if (uid === null) {
      throw new Error('サインインの前に、登録はできません');
    }
    const verdict = validateName(name, this.deps.config);
    if (!verdict.ok) {
      return verdict;
    }
    const profile: Profile = { name: verdict.name, character };
    await this.deps.store.saveProfile(uid, profile);
    this.myProfile = profile;
    void this.enterRoom();
    return verdict;
  }

  /**
   * 名前とキャラクターを変える(自分の画面)。入室や参加者には触れない
   * (参加者の名前と見た目は、次の回から変わる)。
   *
   * @returns 名前の検証の結果。使えない名前なら、保存しない
   * @throws Error - サインインの前に呼んだとき
   * @throws StoreError - 保存に失敗したとき
   */
  async updateProfile(
    name: string,
    character: CharacterSpec
  ): Promise<NameVerdict> {
    const uid = this.myUid;
    if (uid === null) {
      throw new Error('サインインの前に、変更はできません');
    }
    const verdict = validateName(name, this.deps.config);
    if (!verdict.ok) {
      return verdict;
    }
    const profile: Profile = { name: verdict.name, character };
    await this.deps.store.saveProfile(uid, profile);
    this.myProfile = profile;
    return verdict;
  }

  /** 自分の実績を読み直す(自分の画面)。読めなければ null(前に読んだ値は残す) */
  async refreshStats(): Promise<Stats | null> {
    const uid = this.myUid;
    if (uid === null) {
      return null;
    }
    try {
      this.myStats = await this.deps.store.loadStats(uid);
      return this.myStats;
    } catch (error) {
      this.report(error);
      return null;
    }
  }

  // ---- 入室と待機 ----

  private async enterRoom(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.setState({ kind: 'entering' });
    const { store, clock, config } = this.deps;
    const uid = this.myUid!;
    try {
      const now = clock.now();
      const round = roundClockAt(now, config);
      const verdict = canJoinNow(round, now, config);
      const counts = await store.readRoomCounts();
      for (;;) {
        const plan = planRoom(counts, round.phase, verdict, config);
        if (plan.kind === 'wait') {
          this.waitUntilNextRound(plan.reason);
          return;
        }
        if (plan.kind === 'create') {
          this.joinRoom(await store.createRoom(uid));
          return;
        }
        if (await store.tryEnterRoom(plan.roomId, uid, config.roomCapacity)) {
          this.joinRoom(plan.roomId);
          return;
        }
        counts[plan.roomId - 1] = config.roomCapacity; // 取り合いに負けた: 満員として決め直す
      }
    } catch (error) {
      this.report(error);
      if (error instanceof StoreError) {
        // 切断などで決められなかった: しばらくして、やり直す
        this.cancelWait = this.deps.scheduler.after(config.retryMs, () => {
          void this.enterRoom();
        });
      }
    }
  }

  /** 次の回の集合の始めまで待ち、もう一度入室を試す */
  private waitUntilNextRound(reason: WaitReason): void {
    const now = this.deps.clock.now();
    const until = roundClockAt(now, this.deps.config).nextRoundStartsAt;
    this.setState({ kind: 'waiting', reason, until });
    this.cancelWait = this.deps.scheduler.after(until - now, () => {
      void this.enterRoom();
    });
  }

  // ---- 部屋にいるあいだ ----

  private joinRoom(roomId: number): void {
    const uid = this.myUid!;
    if (this.stopped) {
      void this.leave(roomId); // 入室の途中で止められた: 入った部屋を出る
      return;
    }
    this.room = new RoomSeat(this.deps, roomId, uid, () => this.joinRound());
    void this.joinRound();
  }

  /** いまの回の参加者になる(同じ回に2回は足さない) */
  private async joinRound(): Promise<void> {
    const room = this.room!;
    const { clock, config, store } = this.deps;
    const now = clock.now();
    const round = roundClockAt(now, config);
    const id = roundId(round.roundIndex);
    const { joined } = this;
    if (joined?.roomId === room.roomId && joined.roundId === id) {
      this.showInRoom();
      return;
    }
    const joinedDuring = round.phase === 'gathering' ? 'gathering' : 'playing';
    const profile = this.myProfile!;
    const uid = this.myUid!;
    const player: Player = {
      id: uid,
      kind: 'human',
      uid,
      name: profile.name,
      character: profile.character,
      personality: null,
      joinedAt: now, // サーバーが書き直す
      joinedDuring,
    };
    try {
      await store.addPlayer(room.roomId, id, player);
    } catch (error) {
      this.report(error); // 切断なら、つながったときに、もう一度
      return;
    }
    this.joined = { roomId: room.roomId, roundId: id, joinedDuring };
    if (this.room === room) {
      this.showInRoom(); // 足している間に切れていたら、再接続の画面のまま
    }
  }

  private showInRoom(): void {
    const { roomId, roundId: id, joinedDuring } = this.joined!;
    this.setState({ kind: 'inRoom', roomId, roundId: id, joinedDuring });
  }

  // ---- 接続の切断と再接続 ----

  private handleConnection(state: ConnectionState): void {
    if (state === 'online') {
      if (!this.connected) {
        void this.connect();
      } else if (this.lost !== null) {
        void this.recover(this.lost);
      }
      return;
    }
    if (this.room !== null) {
      this.loseRoom();
    }
  }

  /** 部屋にいるあいだに切れた */
  private loseRoom(): void {
    const room = this.room!;
    const { clock, scheduler, config } = this.deps;
    this.lost = { roomId: room.roomId, offlineAt: clock.now() };
    room.close();
    this.room = null;
    this.attempts = 0;
    this.offlineTimers.push(
      scheduler.after(config.offlineScreenDelayMs, () => {
        this.showReconnecting(room.roomId);
        this.offlineTimers.push(
          scheduler.every(config.retryMs, () => {
            this.attempts += 1;
            this.showReconnecting(room.roomId);
          })
        );
      })
    );
  }

  private showReconnecting(roomId: number): void {
    this.setState({ kind: 'reconnecting', roomId, attempts: this.attempts });
  }

  /** つながった。続きから参加するか、次の回から入室する */
  private async recover(lost: LostRoom): Promise<void> {
    this.lost = null;
    cancelAll(this.offlineTimers);
    const { store, clock, config } = this.deps;
    const now = clock.now();
    const round = roundClockAt(now, config);
    const inGrace = now - lost.offlineAt <= config.reconnectGraceMs;
    if (!inGrace || !canJoinNow(round, now, config).ok) {
      if (round.phase === 'gathering') {
        void this.enterRoom();
      } else {
        this.waitUntilNextRound('afterOffline');
      }
      return;
    }
    try {
      const entered = await store.tryEnterRoom(
        lost.roomId,
        this.myUid!,
        config.roomCapacity
      );
      if (entered) {
        this.joinRoom(lost.roomId);
      } else {
        void this.enterRoom(); // その間に満員になった
      }
    } catch (error) {
      this.report(error); // また切れた: 次につながったときに、決め直す
      this.lost = lost;
    }
  }

  // ---- 止める ----

  /** 部屋を出て、すべて止める */
  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.unsubscribeConnection?.();
    cancelAll(this.connectTimers);
    cancelAll(this.offlineTimers);
    this.cancelWait?.();
    const room = this.room;
    this.room = null;
    if (room !== null) {
      room.close();
      await this.leave(room.roomId);
    }
  }

  private leave(roomId: number): Promise<void> {
    return this.deps.store
      .leaveRoom(roomId, this.myUid!)
      .catch((error: unknown) => this.report(error));
  }

  /** StoreError(切断など)は呼ぶ側が扱う。それ以外は onError に伝える */
  private report(error: unknown): void {
    if (!(error instanceof StoreError)) {
      this.deps.onError(error);
    }
  }
}

/** 部屋にいるあいだの購読・AiHost・回のタイマー。部屋を離れるときに、まとめて止める */
class RoomSeat {
  private readonly unsubscribes: Unsubscribe[] = [];
  private readonly aiHost: AiHostHandle;
  private cancelNextRound: Cancel | null = null;
  private members: Readonly<Record<string, Presence>> | null = null;
  private host: string | null | undefined = undefined; // 届くまでは undefined

  constructor(
    private readonly deps: SessionDeps,
    readonly roomId: number,
    private readonly uid: string,
    private readonly onNewRound: () => void
  ) {
    const { store } = deps;
    this.unsubscribes.push(
      store.onPresence(roomId, (members) => {
        this.members = members;
        this.claimIfOldest();
      }),
      store.onAiHost(roomId, (host) => {
        this.host = host;
        this.claimIfOldest();
      })
    );
    this.aiHost = deps.createAiHost({ roomId, uid });
    this.aiHost.start();
    this.scheduleNextRound();
  }

  close(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.aiHost.stop();
    this.cancelNextRound?.();
  }

  /** 次の回の集合の始めに、次の回の参加者になる(くり返す) */
  private scheduleNextRound(): void {
    const now = this.deps.clock.now();
    const next = roundClockAt(now, this.deps.config).nextRoundStartsAt;
    this.cancelNextRound = this.deps.scheduler.after(next - now, () => {
      this.onNewRound();
      this.scheduleNextRound();
    });
  }

  /** AI担当がいない(空、または部屋にいない)とき、自分が最も古い参加者なら、担当を取りにいく */
  private claimIfOldest(): void {
    const { members, host } = this;
    if (members === null || host === undefined) {
      return;
    }
    if (host !== null && host in members) {
      return;
    }
    const [oldest] = Object.entries(members)
      .sort(
        ([a, pa], [b, pb]) =>
          pa.joinedAt - pb.joinedAt || Number(a > b) - Number(a < b)
      )
      .map(([id]) => id);
    if (oldest !== this.uid) {
      return;
    }
    const { store, clock, config, onError } = this.deps;
    const id = roundId(roundClockAt(clock.now(), config).roundIndex);
    void store
      .claimAiHost(this.roomId, id, this.uid)
      .catch((error: unknown) => {
        if (!(error instanceof StoreError)) {
          onError(error);
        }
      });
  }
}

function cancelAll(cancels: Cancel[]): void {
  for (const cancel of cancels.splice(0)) {
    cancel();
  }
}
