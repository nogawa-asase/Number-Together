import { describe, expect, it } from 'vitest';
import { nameUnits } from '../../../../src/domain/names/nameUnits';

describe('nameUnits', () => {
  it.each([
    ['', 0],
    ['abc', 3],
    ['Taro 123!~', 10],
    ['たろう', 6],
    ['ＡＢＣ', 6], // 全角英字
    ['１２', 4], // 全角数字
    ['　', 2], // 全角の空白
    ['たろうABC', 9],
    ['ﾀﾛｳ', 3], // 半角カナ
    ['😀', 2], // サロゲートペアの絵文字も1文字
    ['é', 2], // ASCII でない文字は全角として数える
  ])('「%s」は %i', (name, expected) => {
    expect(nameUnits(name)).toBe(expected);
  });
});
