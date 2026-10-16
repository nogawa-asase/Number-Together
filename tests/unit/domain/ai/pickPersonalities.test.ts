import { describe, expect, it } from 'vitest';
import {
  AI_PERSONALITIES,
  pickPersonalities,
  roundPersonalities,
} from '../../../../src/domain/ai/pickPersonalities';
import { createRandom } from '../../../../src/domain/ai/random';
import { DomainError } from '../../../../src/domain/errors';

describe('pickPersonalities', () => {
  it('0人なら、空', () => {
    expect(pickPersonalities(0, createRandom(1))).toEqual([]);
  });

  it.each([1, 3, 4, 5])('%i人なら、重ならない', (count) => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = pickPersonalities(count, createRandom(seed));
      expect(picked).toHaveLength(count);
      expect(new Set(picked).size).toBe(count);
    }
  });

  it('5人なら、5種類すべて', () => {
    const picked = pickPersonalities(5, createRandom(3));
    expect([...picked].sort()).toEqual([...AI_PERSONALITIES].sort());
  });

  it('7人なら、5種類を一巡してから、重ねて選ぶ', () => {
    const picked = pickPersonalities(7, createRandom(5));
    expect(picked).toHaveLength(7);
    expect(new Set(picked.slice(0, 5)).size).toBe(5);
    expect(new Set(picked.slice(5)).size).toBe(2);
  });

  it('種によって、選ばれる性格が変わる(いつも同じ順ではない)', () => {
    const firsts = new Set(
      Array.from(
        { length: 50 },
        (_, seed) => pickPersonalities(1, createRandom(seed))[0]
      )
    );
    expect(firsts.size).toBe(5);
  });

  it('種を固定すると、再現できる', () => {
    expect(pickPersonalities(4, createRandom(8))).toEqual(
      pickPersonalities(4, createRandom(8))
    );
  });

  it.each([-1, 1.5])('数が %s なら DomainError', (count) => {
    expect(() => pickPersonalities(count, createRandom(1))).toThrow(
      DomainError
    );
  });
});

describe('roundPersonalities', () => {
  it('同じ部屋と回なら、同じ並び(どの端末でも同じ)', () => {
    expect(roundPersonalities(3, '4928211', 4)).toEqual(
      roundPersonalities(3, '4928211', 4)
    );
  });

  it('数を減らしても、先頭はそろう(集合中にAIの席が減っても、残る席の性格は変わらない)', () => {
    const four = roundPersonalities(3, '4928211', 4);
    for (const count of [0, 1, 2, 3]) {
      expect(roundPersonalities(3, '4928211', count)).toEqual(
        four.slice(0, count)
      );
    }
  });

  it('5人までは、性格が重ならない', () => {
    expect(new Set(roundPersonalities(1, '1', 5)).size).toBe(5);
  });

  it('部屋や回が違えば、並びが変わりうる', () => {
    const lists = new Set(
      Array.from({ length: 20 }, (_, i) =>
        roundPersonalities(1, String(4_928_211 + i), 4).join(',')
      )
    );
    expect(lists.size).toBeGreaterThan(1);
    const rooms = new Set(
      Array.from({ length: 20 }, (_, i) =>
        roundPersonalities(i, '4928211', 4).join(',')
      )
    );
    expect(rooms.size).toBeGreaterThan(1);
  });

  it('数が不正なら DomainError', () => {
    expect(() => roundPersonalities(1, '1', -1)).toThrow(DomainError);
  });
});
