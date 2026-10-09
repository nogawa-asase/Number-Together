/** ストアの失敗の種類 */
export type StoreErrorKind =
  | 'offline' // 接続が切れている
  | 'permissionDenied' // ルールに拒否された(書き込みの拒否は、例外にせず無視するので、主に読み取り)
  | 'notSignedIn' // サインインの前に呼んだ
  | 'unknown'; // 想定外

/**
 * ストア(GameStore)の失敗。Firebase の例外は、インフラ層の中で、これに変える
 * (docs/development-guidelines.md「エラーハンドリング」)。
 */
export class StoreError extends Error {
  readonly kind: StoreErrorKind;

  constructor(kind: StoreErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'StoreError';
    this.kind = kind;
  }
}
