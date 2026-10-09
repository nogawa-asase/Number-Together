/** 半角として数える文字。ASCII の印字できる文字(U+0020〜U+007E)と、半角カナ(U+FF61〜U+FF9F) */
const HALF_WIDTH = /^[\u0020-\u007e\uff61-\uff9f]$/u;

/**
 * 名前の長さを、全角を2、半角を1と数えた合計で求める(docs/glossary.md「名前」)。
 *
 * 画面に表示したときの幅が同じくらいになるよう、全角6文字・半角12文字を同じ長さとみなす。
 * 文字はコードポイント単位で数える(絵文字も、1文字で2)。
 *
 * @param name - 名前(前後の空白を取るのは、validateName の仕事)
 */
export function nameUnits(name: string): number {
  let units = 0;
  for (const char of name) {
    units += HALF_WIDTH.test(char) ? 1 : 2;
  }
  return units;
}
