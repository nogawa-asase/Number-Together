/**
 * ドメイン層の関数に、不正な入力が渡されたときのエラー。
 *
 * 呼ぶ側のバグを表すので、結果の値ではなく、例外にする
 * (利用者の入力の誤りは、validateName のように、結果の値で返す)。
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
