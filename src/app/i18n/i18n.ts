import type { Lang, MessageKey, Messages } from './keys';
import { en } from './messages.en';
import { ja } from './messages.ja';

export type { Lang, MessageKey } from './keys';

const MESSAGES: Readonly<Record<Lang, Messages>> = { ja, en };

let current: Lang = 'ja';
const listeners = new Set<(lang: Lang) => void>();

/** いまの言語 */
export function getLang(): Lang {
  return current;
}

/**
 * 言語を変える。変わったときだけ、登録した関数すべてに知らせる。
 * ブラウザに覚えるのは、main.ts が onLangChange で行う(i18n は infra に依存しない)
 */
export function setLang(lang: Lang): void {
  if (lang === current) {
    return;
  }
  current = lang;
  for (const listener of [...listeners]) {
    listener(lang);
  }
}

/** 言語が変わったら知らせる */
export function onLangChange(listener: (lang: Lang) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * いまの言語の文言。{name} の形の引数を埋める(ない引数は、そのまま残す)。
 *
 * @param key - 文言のキー
 * @param params - 引数
 */
export function t(
  key: MessageKey,
  params: Readonly<Record<string, string | number>> = {}
): string {
  return MESSAGES[current][key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  );
}

/**
 * 初めて開いたときの言語。ブラウザの言語設定が日本語なら日本語、それ以外は英語(仮)。
 *
 * @param languages - ブラウザの言語設定(navigator.languages)
 */
export function detectLang(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
