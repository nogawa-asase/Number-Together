import type { GameConfig } from '../config/types';
import { nameUnits } from './nameUnits';

/** 名前の検証の結果。よければ、保存する名前(前後の空白を取ったもの)を返す */
export type NameVerdict =
  | { readonly ok: true; readonly name: string }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'tooLong' | 'invalidChar';
    };

/**
 * 使えない文字。制御文字(Cc)、ゼロ幅や文字の向きの上書きなどの見えない書式文字(Cf)、
 * 対になっていないサロゲート(Cs)、私用領域(Co)、行と段落の区切り(Zl・Zp)
 */
const INVALID_CHAR = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u;

/**
 * 名前を検証する(docs/functional-design.md「Names(名前の長さ)」)。
 *
 * 前後の空白を取ってから、空でないか、使えない文字がないか、
 * 長さ(全角を2、半角を1と数えた合計)が nameMaxUnits 以下かを調べる。
 * 利用者の入力の誤りなので、例外ではなく、結果の値で返す。
 *
 * @param name - 利用者が入力した名前
 * @param config - 設定値(nameMaxUnits を使う)
 */
export function validateName(name: string, config: GameConfig): NameVerdict {
  const trimmed = name.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'empty' };
  }
  if (INVALID_CHAR.test(trimmed)) {
    return { ok: false, reason: 'invalidChar' };
  }
  if (nameUnits(trimmed) > config.nameMaxUnits) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true, name: trimmed };
}
