import type { GameConfig } from '../../domain/config/types';
import type { StatsDelta } from '../../domain/points/types';
import { roundClockAt, roundId } from '../../domain/schedule/roundClockAt';
import type {
  AiPersonality,
  Player,
  Profile,
  Pulse,
  Stats,
} from '../../domain/types';
import type { Presence, Unsubscribe } from '../store/GameStore';
import type { ServerClock } from '../store/ServerClock';

/** ルールに拒否された書き込みの記録(テストで確かめるため) */
export interface Rejection {
  readonly uid: string;
  readonly action: string;
  readonly reason: string;
}

interface RoundData {
  number: number;
  readonly players: Map<string, Player>;
  readonly pulses: Map<string, Pulse>;
  readonly points: Map<string, number>;
}

interface RoomData {
  memberCount: number;
  readonly presence: Map<string, Presence>;
  aiHost: string | null;
  readonly rounds: Map<string, RoundData>;
}

const PERSONALITIES: readonly AiPersonality[] = [
  'greedy',
  'balancer',
  'perfectionist',
  'moody',
  'lastSpurt',
];
const NAME_MAX_LENGTH = 12; // ルールの「名前は1〜12文字」(粗い検査)
const PART_MAX_LENGTH = 20; // ルールの「キャラクターの部品は20文字まで」

const EMPTY_STATS: Stats = {
  plays: 0,
  successes: 0,
  perfects: 0,
  totalPoints: 0,
  lastCountedRound: null,
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/**
 * メモリ上の「サーバー」。全員で共有するデータと、セキュリティルール(database.rules.json)と同じ判断を持つ
 * (Firebase の Realtime Database に当たる)。利用者ごとの窓口は InMemoryGameStore。
 *
 * - ルールの値(1周・ゲーム中・猶予・人数・±50)は、config から計算する
 * - 拒否された書き込みは、何も変えずに rejections に残す
 * - 値が変わったら、購読者に、その場で(同期的に)知らせる
 */
export class InMemoryServer {
  /** ルールに拒否された書き込みの記録 */
  readonly rejections: Rejection[] = [];

  private nextUserNumber = 1;
  private readonly profiles = new Map<string, Profile>();
  private readonly stats = new Map<string, Stats>();
  private roomCount = 0;
  private readonly rooms = new Map<number, RoomData>();
  private readonly topics = new Map<string, Set<() => void>>();

  constructor(
    readonly clock: ServerClock,
    readonly config: GameConfig
  ) {}

  // ---- 購読 ----

  /** topic が変わったら emit を呼ぶ。登録したときにも1回呼ぶ */
  subscribe(topic: string, emit: () => void): Unsubscribe {
    const listeners = this.topics.get(topic) ?? new Set();
    this.topics.set(topic, listeners);
    listeners.add(emit);
    emit();
    return () => {
      listeners.delete(emit);
    };
  }

  private notify(topic: string): void {
    for (const emit of [...(this.topics.get(topic) ?? [])]) {
      emit();
    }
  }

  private reject(uid: string, action: string, reason: string): false {
    this.rejections.push({ uid, action, reason });
    return false;
  }

  // ---- 時計(ルールの now % 周期 と同じ計算) ----

  private timeNow() {
    const now = this.clock.now();
    const clock = roundClockAt(now, this.config);
    return {
      now,
      currentRoundId: roundId(clock.roundIndex),
      playing: clock.playStartsAt <= now && now < clock.playEndsAt,
      // ゲーム開始から、終了の pointsGraceMs 後まで(ポイントを書ける間)
      pointsWritable:
        clock.playStartsAt <= now &&
        now < clock.playEndsAt + this.config.pointsGraceMs,
      // 終了の pointsGraceMs 後から(他の人のポイントを読める)
      pointsPublic: now >= clock.playEndsAt + this.config.pointsGraceMs,
    };
  }

  // ---- 利用者・プロフィール・実績 ----

  issueUid(): string {
    return `user-${this.nextUserNumber++}`;
  }

  loadProfile(uid: string): Profile | null {
    return this.profiles.get(uid) ?? null;
  }

  saveProfile(caller: string, uid: string, profile: Profile): boolean {
    if (caller !== uid) {
      return this.reject(caller, 'saveProfile', '本人だけ');
    }
    const { name, character } = profile;
    const parts = [character.hair, character.shirtColor, character.accessory];
    if (
      name.length === 0 ||
      name.length > NAME_MAX_LENGTH ||
      parts.some((part) => part.length > PART_MAX_LENGTH)
    ) {
      return this.reject(caller, 'saveProfile', '名前・部品の長さ');
    }
    this.profiles.set(uid, { name, character: { ...character } });
    return true;
  }

  loadStats(uid: string): Stats {
    return this.stats.get(uid) ?? EMPTY_STATS;
  }

  applyStats(
    caller: string,
    uid: string,
    round: string,
    delta: StatsDelta
  ): boolean {
    if (caller !== uid) {
      return this.reject(caller, 'applyStats', '本人だけ');
    }
    const current = this.loadStats(uid);
    if (current.lastCountedRound === round) {
      return true; // 同じ回は、二重に数えない
    }
    const next: Stats = {
      plays: current.plays + delta.plays,
      successes: current.successes + delta.successes,
      perfects: current.perfects + delta.perfects,
      totalPoints: current.totalPoints + delta.totalPoints,
      lastCountedRound: round,
    };
    if (
      ![next.plays, next.successes, next.perfects, next.totalPoints].every(
        isCount
      )
    ) {
      return this.reject(caller, 'applyStats', '実績は0以上の整数');
    }
    this.stats.set(uid, next);
    return true;
  }

  // ---- 部屋・参加中の印・AI担当 ----

  readRoomCounts(): number[] {
    // 部屋は1から順に作るので、Map の順(作った順)が、部屋の番号の順
    return [...this.rooms.values()].map((room) => room.memberCount);
  }

  private room(roomId: number): RoomData | undefined {
    return this.rooms.get(roomId);
  }

  tryEnterRoom(caller: string, roomId: number, capacity: number): boolean {
    const room = this.room(roomId);
    if (room === undefined) {
      return this.reject(caller, 'tryEnterRoom', '部屋がない');
    }
    if (room.presence.has(caller)) {
      return true; // すでに入っている
    }
    const limit = Math.min(capacity, this.config.roomCapacity);
    if (room.memberCount >= limit) {
      return false; // 満員(条件付きの書き込みに負けた)
    }
    room.memberCount += 1;
    room.presence.set(caller, { joinedAt: this.clock.now() });
    this.notify(`presence:${roomId}`);
    return true;
  }

  createRoom(caller: string): number {
    this.roomCount += 1;
    const roomId = this.roomCount;
    this.rooms.set(roomId, {
      memberCount: 0,
      presence: new Map(),
      aiHost: null,
      rounds: new Map(),
    });
    this.tryEnterRoom(caller, roomId, this.config.roomCapacity);
    return roomId;
  }

  leaveRoom(caller: string, roomId: number): void {
    const room = this.room(roomId);
    if (room === undefined || !room.presence.delete(caller)) {
      return;
    }
    room.memberCount = Math.max(0, room.memberCount - 1);
    this.notify(`presence:${roomId}`);
  }

  /** 接続が切れた利用者の印を、すべての部屋から消す(Firebase の onDisconnect) */
  dropConnection(caller: string): void {
    for (const roomId of this.rooms.keys()) {
      this.leaveRoom(caller, roomId);
    }
  }

  presenceOf(roomId: number): Record<string, Presence> {
    return Object.fromEntries(this.room(roomId)?.presence ?? []);
  }

  claimAiHost(caller: string, roomId: number): boolean {
    const room = this.room(roomId);
    if (room === undefined) {
      return this.reject(caller, 'claimAiHost', '部屋がない');
    }
    if (room.aiHost !== null && room.presence.has(room.aiHost)) {
      return room.aiHost === caller; // 担当がまだ部屋にいる(自分なら、そのまま)
    }
    room.aiHost = caller;
    this.notify(`aiHost:${roomId}`);
    return true;
  }

  aiHostOf(roomId: number): string | null {
    return this.room(roomId)?.aiHost ?? null;
  }

  // ---- 回 ----

  private roundData(roomId: number, round: string): RoundData | undefined {
    return this.room(roomId)?.rounds.get(round);
  }

  /** 回のデータを、なければ作る(書き込みが通ったときだけ呼ぶ) */
  private ensureRound(room: RoomData, round: string): RoundData {
    let data = room.rounds.get(round);
    if (data === undefined) {
      data = {
        number: 0,
        players: new Map(),
        pulses: new Map(),
        points: new Map(),
      };
      room.rounds.set(round, data);
    }
    return data;
  }

  /** caller が、playerId の分を書けるか(自分、または AI担当で、その参加者が AI) */
  private canWriteFor(
    caller: string,
    roomId: number,
    round: string,
    playerId: string
  ): boolean {
    return (
      playerId === caller ||
      (this.aiHostOf(roomId) === caller &&
        this.roundData(roomId, round)?.players.get(playerId)?.kind === 'ai')
    );
  }

  addPlayer(
    caller: string,
    roomId: number,
    round: string,
    player: Player
  ): boolean {
    const time = this.timeNow();
    const room = this.room(roomId);
    if (room === undefined || round !== time.currentRoundId) {
      return this.reject(caller, 'addPlayer', 'いまの回だけ');
    }
    if (this.roundData(roomId, round)?.players.has(player.id)) {
      return this.reject(caller, 'addPlayer', '追加だけ(書き換え不可)');
    }
    const allowed =
      player.kind === 'human'
        ? player.id === caller && player.uid === caller
        : this.aiHostOf(roomId) === caller &&
          player.personality !== null &&
          PERSONALITIES.includes(player.personality);
    if (!allowed) {
      return this.reject(
        caller,
        'addPlayer',
        '人間は自分だけ、AIは AI担当だけ'
      );
    }
    if (player.name.length > NAME_MAX_LENGTH) {
      return this.reject(caller, 'addPlayer', '名前の長さ');
    }
    this.ensureRound(room, round).players.set(player.id, {
      ...player,
      joinedAt: time.now,
    });
    this.notify(`players:${roomId}:${round}`);
    return true;
  }

  playersOf(roomId: number, round: string): Player[] {
    return [...(this.roundData(roomId, round)?.players.values() ?? [])];
  }

  addToNumber(
    caller: string,
    roomId: number,
    round: string,
    delta: number
  ): boolean {
    const time = this.timeNow();
    const room = this.room(roomId);
    if (room === undefined || round !== time.currentRoundId || !time.playing) {
      return this.reject(caller, 'addToNumber', 'いまの回の、ゲーム中だけ');
    }
    if (
      !Number.isSafeInteger(delta) ||
      Math.abs(delta) > this.config.maxDeltaPerWrite
    ) {
      return this.reject(caller, 'addToNumber', '1回の変化は ±50 まで');
    }
    this.ensureRound(room, round).number += delta;
    this.notify(`number:${roomId}:${round}`);
    return true;
  }

  numberOf(roomId: number, round: string): number {
    return this.roundData(roomId, round)?.number ?? 0;
  }

  sendPulse(
    caller: string,
    roomId: number,
    round: string,
    playerId: string,
    power: number
  ): boolean {
    const time = this.timeNow();
    const room = this.room(roomId);
    if (room === undefined || round !== time.currentRoundId || !time.playing) {
      return this.reject(caller, 'sendPulse', 'いまの回の、ゲーム中だけ');
    }
    if (!this.canWriteFor(caller, roomId, round, playerId)) {
      return this.reject(caller, 'sendPulse', '自分(AIは AI担当)だけ');
    }
    if (!Number.isSafeInteger(power) || power < 0 || power > 3) {
      return this.reject(caller, 'sendPulse', 'power は 0〜3 の整数');
    }
    this.ensureRound(room, round).pulses.set(playerId, { t: time.now, power });
    this.notify(`pulses:${roomId}:${round}`);
    return true;
  }

  pulsesOf(roomId: number, round: string): Record<string, Pulse> {
    return Object.fromEntries(this.roundData(roomId, round)?.pulses ?? []);
  }

  writePoints(
    caller: string,
    roomId: number,
    round: string,
    playerId: string,
    points: number
  ): boolean {
    const time = this.timeNow();
    const room = this.room(roomId);
    if (
      room === undefined ||
      round !== time.currentRoundId ||
      !time.pointsWritable
    ) {
      return this.reject(
        caller,
        'writePoints',
        'いまの回の、ゲーム開始から終了の3秒後まで'
      );
    }
    if (!this.canWriteFor(caller, roomId, round, playerId)) {
      return this.reject(caller, 'writePoints', '自分(AIは AI担当)だけ');
    }
    const data = this.ensureRound(room, round);
    if (!isCount(points) || points < (data.points.get(playerId) ?? 0)) {
      return this.reject(caller, 'writePoints', '0以上の整数で、減らない');
    }
    data.points.set(playerId, points);
    return true;
  }

  /** caller が読める分のポイント(自分の分はいつでも、他の人の分は終了の3秒後から) */
  readPoints(
    caller: string,
    roomId: number,
    round: string
  ): Record<string, number> {
    const time = this.timeNow();
    const othersReadable = round !== time.currentRoundId || time.pointsPublic;
    const entries = [...(this.roundData(roomId, round)?.points ?? [])].filter(
      ([playerId]) => playerId === caller || othersReadable
    );
    return Object.fromEntries(entries);
  }

  deleteRound(caller: string, roomId: number, round: string): boolean {
    const room = this.room(roomId);
    if (room === undefined || room.aiHost !== caller) {
      return this.reject(caller, 'deleteRound', 'AI担当だけ');
    }
    if (round === this.timeNow().currentRoundId) {
      return this.reject(caller, 'deleteRound', 'いまの回は消せない');
    }
    room.rounds.delete(round);
    for (const topic of ['players', 'number', 'pulses']) {
      this.notify(`${topic}:${roomId}:${round}`);
    }
    return true;
  }
}
