import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';
import { validateName } from '../../../../src/domain/names/validateName';

describe('validateName', () => {
  describe('長さ', () => {
    it.each([
      'たろうたろう', // 全角6文字 = 12
      'abcdefghijkl', // 半角12文字 = 12
      'たろうabcdef', // 全角3 + 半角6 = 12
      'a', // 1文字
    ])('「%s」は、よい', (name) => {
      expect(validateName(name, DEFAULT_CONFIG)).toEqual({ ok: true, name });
    });

    it.each([
      'たろうたろうa', // 全角6 + 半角1 = 13
      'abcdefghijklm', // 半角13文字
      'たろうたろうた', // 全角7文字 = 14
    ])('「%s」は、長すぎる', (name) => {
      expect(validateName(name, DEFAULT_CONFIG)).toEqual({
        ok: false,
        reason: 'tooLong',
      });
    });

    it('長さの上限は、設定で変えられる', () => {
      const config = { ...DEFAULT_CONFIG, nameMaxUnits: 4 };
      expect(validateName('たろう', config)).toEqual({
        ok: false,
        reason: 'tooLong',
      });
    });
  });

  describe('前後の空白', () => {
    it('前後の空白を取った名前を返す', () => {
      expect(validateName('  たろう　', DEFAULT_CONFIG)).toEqual({
        ok: true,
        name: 'たろう',
      });
    });

    it('前後の空白は、長さに数えない', () => {
      expect(validateName(' abcdefghijkl ', DEFAULT_CONFIG)).toEqual({
        ok: true,
        name: 'abcdefghijkl',
      });
    });

    it('間の空白は、そのまま残して数える', () => {
      expect(validateName('ta ro', DEFAULT_CONFIG)).toEqual({
        ok: true,
        name: 'ta ro',
      });
    });
  });

  describe('空', () => {
    it.each(['', '   ', '　　'])('「%s」は、空', (name) => {
      expect(validateName(name, DEFAULT_CONFIG)).toEqual({
        ok: false,
        reason: 'empty',
      });
    });
  });

  describe('使えない文字', () => {
    it.each([
      ['改行', 'ta\nro'],
      ['タブ', 'ta\tro'],
      ['NUL', 'ta\u0000ro'],
      ['DEL', 'ta\u007fro'],
      ['ゼロ幅スペース', 'ta​ro'],
      ['文字の向きの上書き', 'ta‮ro'],
      ['対になっていないサロゲート', 'ta\ud800ro'],
      ['私用領域', 'taro'],
      ['行の区切り', 'ta ro'],
    ])('%s は、使えない', (_label, name) => {
      expect(validateName(name, DEFAULT_CONFIG)).toEqual({
        ok: false,
        reason: 'invalidChar',
      });
    });

    it('絵文字・記号は、使える', () => {
      expect(validateName('🎉<b>&', DEFAULT_CONFIG)).toEqual({
        ok: true,
        name: '🎉<b>&',
      });
    });
  });
});
