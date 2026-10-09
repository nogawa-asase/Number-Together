import type { ja } from './messages.ja';

/** 文言のキー(日本語の一覧が正) */
export type MessageKey = keyof typeof ja;

/** 言語ごとの文言の一覧。すべてのキーを持つ(足りなければ、型のエラーでビルドが失敗する) */
export type Messages = Readonly<Record<MessageKey, string>>;

/** 言語 */
export type Lang = 'ja' | 'en';
