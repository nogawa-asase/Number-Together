import { AI_PERSONALITIES } from '../../domain/ai/pickPersonalities';
import {
  ACCESSORIES,
  DEFAULT_CHARACTER,
  HAIRS,
  SHIRT_COLORS,
} from '../../domain/character/parts';
import type {
  AiPersonality,
  CharacterSpec,
  Player,
  Profile,
  Pulse,
  Stats,
} from '../../domain/types';
import type { Presence } from '../store/GameStore';

/**
 * データベースから読んだ値の検証(docs/development-guidelines.md「Firebase の扱い方」)。
 *
 * 他の人が書いた値は、信用しない。形が想定と違う値は、無視するか、既定の値にする
 * (壊れたデータで、画面が止まらないようにする)。
 */

type Raw = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function oneOf<T extends string>(
  list: readonly T[],
  value: unknown,
  fallback: T
): T {
  return list.includes(value as T) ? (value as T) : fallback;
}

/** キャラクター。知らない部品は、既定の部品にする */
export function parseCharacter(raw: unknown): CharacterSpec {
  const source = isObject(raw) ? raw : {};
  return {
    hair: oneOf(HAIRS, source.hair, DEFAULT_CHARACTER.hair),
    shirtColor: oneOf(
      SHIRT_COLORS,
      source.shirtColor,
      DEFAULT_CHARACTER.shirtColor
    ),
    accessory: oneOf(
      ACCESSORIES,
      source.accessory,
      DEFAULT_CHARACTER.accessory
    ),
  };
}

/** プロフィール。名前がなければ、ないものとする */
export function parseProfile(raw: unknown): Profile | null {
  if (!isObject(raw) || typeof raw.name !== 'string' || raw.name === '') {
    return null;
  }
  return { name: raw.name, character: parseCharacter(raw.character) };
}

/** 実績。壊れた数は0にする */
export function parseStats(raw: unknown): Stats {
  const source = isObject(raw) ? raw : {};
  const count = (value: unknown) => (isCount(value) ? value : 0);
  return {
    plays: count(source.plays),
    successes: count(source.successes),
    perfects: count(source.perfects),
    totalPoints: count(source.totalPoints),
    lastCountedRound:
      typeof source.lastCountedRound === 'string'
        ? source.lastCountedRound
        : null,
  };
}

/**
 * 参加者。種類・入った時刻・入った段階がなければ、ないものとする。
 * AIの性格が一覧になければ null(AiHost は受け持たない)
 */
export function parsePlayer(id: string, raw: unknown): Player | null {
  if (
    !isObject(raw) ||
    (raw.kind !== 'human' && raw.kind !== 'ai') ||
    !isTime(raw.joinedAt) ||
    (raw.joinedDuring !== 'gathering' && raw.joinedDuring !== 'playing')
  ) {
    return null;
  }
  const human = raw.kind === 'human';
  const personality = AI_PERSONALITIES.includes(
    raw.personality as AiPersonality
  )
    ? (raw.personality as AiPersonality)
    : null;
  return {
    id,
    kind: raw.kind,
    uid: human ? id : null,
    name: typeof raw.name === 'string' ? raw.name : '',
    character: human ? parseCharacter(raw.character) : null,
    personality: human ? null : personality,
    joinedAt: raw.joinedAt,
    joinedDuring: raw.joinedDuring,
  };
}

/** 参加者の一覧。壊れた人は除く */
export function parsePlayers(raw: unknown): Player[] {
  if (!isObject(raw)) {
    return [];
  }
  return Object.entries(raw)
    .map(([id, value]) => parsePlayer(id, value))
    .filter((player): player is Player => player !== null);
}

/** 合図の一覧。壊れた合図は除く(power の範囲は、使う側の jumpFor が確かめる) */
export function parsePulses(raw: unknown): Record<string, Pulse> {
  if (!isObject(raw)) {
    return {};
  }
  const pulses: Record<string, Pulse> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (isObject(value) && isTime(value.t) && isTime(value.power)) {
      pulses[id] = { t: value.t, power: value.power };
    }
  }
  return pulses;
}

/** 参加中の印の一覧。壊れた印は除く */
export function parsePresence(raw: unknown): Record<string, Presence> {
  if (!isObject(raw)) {
    return {};
  }
  const members: Record<string, Presence> = {};
  for (const [uid, value] of Object.entries(raw)) {
    if (isObject(value) && isTime(value.joinedAt)) {
      members[uid] = { joinedAt: value.joinedAt };
    }
  }
  return members;
}

/** 共有の数字。まだなければ(壊れていれば)0 */
export function parseNumber(raw: unknown): number {
  return typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : 0;
}

/** ポイント。0以上の整数でなければ、ないものとする */
export function parsePoints(raw: unknown): number | null {
  return isCount(raw) ? raw : null;
}

/** AI担当の uid。文字列でなければ、いないものとする */
export function parseUid(raw: unknown): string | null {
  return typeof raw === 'string' && raw !== '' ? raw : null;
}
