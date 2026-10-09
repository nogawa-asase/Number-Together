import { describe, expect, it } from 'vitest';
import { pressChance } from '../../../../src/domain/ai/pressChance';

describe('pressChance', () => {
  it('1秒に2回で、tick が250ミリ秒なら、0.5', () => {
    expect(pressChance(2, 250)).toBe(0.5);
  });

  it('tick より速くは押せない(上限1)', () => {
    expect(pressChance(8, 250)).toBe(1);
  });

  it('頻度が0なら、押さない', () => {
    expect(pressChance(0, 250)).toBe(0);
  });

  it.each([0, -10])('tick の長さが %i なら、押さない', (dtMs) => {
    expect(pressChance(4, dtMs)).toBe(0);
  });
});
