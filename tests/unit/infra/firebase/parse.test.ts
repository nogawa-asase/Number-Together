import { describe, expect, it } from 'vitest';
import {
  parseCharacter,
  parseNumber,
  parsePlayer,
  parsePlayers,
  parsePoints,
  parsePresence,
  parseProfile,
  parsePulses,
  parseStats,
  parseUid,
} from '../../../../src/infra/firebase/parse';

const CHARACTER = { hair: 'bun', shirtColor: 'green', accessory: 'cap' };
const HUMAN = {
  id: 'u1',
  kind: 'human',
  uid: 'u1',
  name: 'たろう',
  character: CHARACTER,
  joinedAt: 100,
  joinedDuring: 'gathering',
};

describe('parseCharacter', () => {
  it('知っている部品はそのまま、知らない部品・形の違う値は既定の部品にする', () => {
    expect(parseCharacter(CHARACTER)).toEqual(CHARACTER);
    expect(parseCharacter({ hair: '<b>', shirtColor: 1 })).toEqual({
      hair: 'ponytail',
      shirtColor: 'pink',
      accessory: 'none',
    });
    expect(parseCharacter(null)).toEqual(parseCharacter({}));
  });
});

describe('parseProfile', () => {
  it('名前がなければ null', () => {
    expect(parseProfile({ name: 'たろう', character: CHARACTER })).toEqual({
      name: 'たろう',
      character: CHARACTER,
    });
    expect(parseProfile({ name: '', character: CHARACTER })).toBeNull();
    expect(parseProfile({ character: CHARACTER })).toBeNull();
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile([1])).toBeNull();
  });
});

describe('parseStats', () => {
  it('壊れた数は0、最後に数えた回は文字列だけ', () => {
    expect(
      parseStats({
        plays: 3,
        successes: -1,
        perfects: 1.5,
        totalPoints: '9',
        lastCountedRound: 12,
      })
    ).toEqual({
      plays: 3,
      successes: 0,
      perfects: 0,
      totalPoints: 0,
      lastCountedRound: null,
    });
    expect(parseStats(undefined)).toEqual({
      plays: 0,
      successes: 0,
      perfects: 0,
      totalPoints: 0,
      lastCountedRound: null,
    });
    expect(parseStats({ lastCountedRound: '7' }).lastCountedRound).toBe('7');
  });
});

describe('parsePlayer', () => {
  it('人間: id は場所の名前、uid は id、キャラクターを検証する', () => {
    expect(parsePlayer('u1', { ...HUMAN, uid: 'someone' })).toEqual({
      ...HUMAN,
      personality: null,
    });
  });

  it('AI: 性格が一覧になければ null の性格にする。キャラクターはない', () => {
    const ai = {
      kind: 'ai',
      personality: 'greedy',
      joinedAt: 1,
      joinedDuring: 'playing',
    };
    expect(parsePlayer('ai-1', ai)).toEqual({
      id: 'ai-1',
      kind: 'ai',
      uid: null,
      name: '',
      character: null,
      personality: 'greedy',
      joinedAt: 1,
      joinedDuring: 'playing',
    });
    expect(
      parsePlayer('ai-1', { ...ai, personality: 'boss' })!.personality
    ).toBeNull();
  });

  it.each([
    ['オブジェクトでない', 'x'],
    ['種類がない', { ...HUMAN, kind: 'cat' }],
    ['時刻がない', { ...HUMAN, joinedAt: 'now' }],
    ['段階がない', { ...HUMAN, joinedDuring: 'later' }],
  ])('%s なら null', (_label, raw) => {
    expect(parsePlayer('u1', raw)).toBeNull();
  });

  it('一覧は、壊れた人を除く', () => {
    expect(
      parsePlayers({ u1: HUMAN, u2: { kind: 'x' } }).map((p) => p.id)
    ).toEqual(['u1']);
    expect(parsePlayers(null)).toEqual([]);
  });
});

describe('parsePulses・parsePresence', () => {
  it('壊れた値を除く', () => {
    expect(
      parsePulses({ a: { t: 1, power: 2 }, b: { t: 'x', power: 1 }, c: 3 })
    ).toEqual({
      a: { t: 1, power: 2 },
    });
    expect(parsePulses(undefined)).toEqual({});
    expect(parsePresence({ a: { joinedAt: 5 }, b: {}, c: true })).toEqual({
      a: { joinedAt: 5 },
    });
    expect(parsePresence(null)).toEqual({});
  });
});

describe('parseNumber・parsePoints・parseUid', () => {
  it('形の違う値は、0・null', () => {
    expect(parseNumber(-12)).toBe(-12);
    expect(parseNumber(1.5)).toBe(0);
    expect(parseNumber(null)).toBe(0);
    expect(parsePoints(10)).toBe(10);
    expect(parsePoints(-1)).toBeNull();
    expect(parsePoints('3')).toBeNull();
    expect(parseUid('u1')).toBe('u1');
    expect(parseUid('')).toBeNull();
    expect(parseUid(3)).toBeNull();
  });
});
