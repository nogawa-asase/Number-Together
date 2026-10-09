import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  DEFAULT_CHARACTER,
  HAIRS,
  randomCharacter,
  SHIRT_COLORS,
} from '../../../../src/domain/character/parts';
import { fixedRandom } from '../../fixtures/random';
import { createRandom } from '../../../../src/domain/ai/random';

describe('キャラクターの部品', () => {
  it('髪型5種類・服の色8色・小物5種類(なしを含む)', () => {
    expect(HAIRS).toHaveLength(5);
    expect(SHIRT_COLORS).toHaveLength(8);
    expect(ACCESSORIES).toHaveLength(5);
    expect(ACCESSORIES).toContain('none');
  });

  it('最初の見た目は、一覧の中から', () => {
    expect(HAIRS).toContain(DEFAULT_CHARACTER.hair);
    expect(SHIRT_COLORS).toContain(DEFAULT_CHARACTER.shirtColor);
    expect(ACCESSORIES).toContain(DEFAULT_CHARACTER.accessory);
  });

  it('おまかせは、乱数で一覧から選ぶ(0なら先頭、1に近ければ末尾)', () => {
    expect(randomCharacter(fixedRandom(0))).toEqual({
      hair: 'short',
      shirtColor: 'pink',
      accessory: 'none',
    });
    expect(randomCharacter(fixedRandom(0.999))).toEqual({
      hair: 'bun',
      shirtColor: 'purple',
      accessory: 'headphones',
    });
  });

  it('おまかせを何度も選ぶと、いろいろな見た目になる', () => {
    const random = createRandom(1);
    const hairs = new Set(
      Array.from({ length: 50 }, () => randomCharacter(random).hair)
    );
    expect(hairs.size).toBe(HAIRS.length);
  });
});
