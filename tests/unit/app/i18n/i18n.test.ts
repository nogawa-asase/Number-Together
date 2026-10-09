import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectLang,
  getLang,
  onLangChange,
  setLang,
  t,
} from '../../../../src/app/i18n/i18n';
import { en } from '../../../../src/app/i18n/messages.en';
import { ja } from '../../../../src/app/i18n/messages.ja';

afterEach(() => {
  setLang('ja');
});

describe('文言の一覧', () => {
  it('日本語と英語は、同じキーをすべて持ち、空の文言がない', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
    for (const text of [...Object.values(ja), ...Object.values(en)]) {
      expect(text.trim()).not.toBe('');
    }
  });

  it('引数の名前は、日本語と英語で同じ', () => {
    const params = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      expect(params(en[key]), key).toEqual(params(ja[key]));
    }
  });

  it('切り替えボタンには、切り替えた先の言語名を出す', () => {
    expect(ja['lang.switch']).toBe('English');
    expect(en['lang.switch']).toBe('日本語');
  });
});

describe('t', () => {
  it('いまの言語の文言を返し、引数を埋める', () => {
    expect(t('offline.attempt', { n: 3 })).toBe('3回目のトライ中');
    setLang('en');
    expect(t('offline.attempt', { n: 3 })).toBe('Attempt 3');
  });

  it('ない引数は、そのまま残す', () => {
    expect(t('setup.count', { used: 6 })).toBe('6 / {max}');
  });
});

describe('言語の切り替え', () => {
  it('変わったときだけ知らせる。解除のあとは知らせない', () => {
    const listener = vi.fn();
    const off = onLangChange(listener);
    setLang('ja');
    expect(listener).not.toHaveBeenCalled();
    setLang('en');
    expect(listener).toHaveBeenCalledWith('en');
    expect(getLang()).toBe('en');
    off();
    setLang('ja');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    [['ja-JP', 'en-US'], 'ja'],
    [['JA'], 'ja'],
    [['en-US', 'ja'], 'en'],
    [['fr'], 'en'],
    [[], 'en'],
  ])('ブラウザの言語 %j なら %s', (languages, lang) => {
    expect(detectLang(languages)).toBe(lang);
  });
});
