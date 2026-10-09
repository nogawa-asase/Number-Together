/** ブラウザに覚える設定の名前 */
export type PrefKey = 'lang' | 'reduceMotion';

/** ブラウザに覚える設定(言語・「動きをへらす」) */
export interface Prefs {
  get(key: PrefKey): string | null;
  set(key: PrefKey, value: string): void;
}

const PREFIX = 'number-together.';

/**
 * 設定を覚える入れ物を作る。storage が使えなければ(itch.io の iframe など)、開いている間だけ保つ。
 *
 * @param storage - localStorage。取り出せなかったら null
 */
export function createPrefs(storage: Storage | null): Prefs {
  const memory = new Map<PrefKey, string>();
  return {
    get(key) {
      try {
        return storage?.getItem(PREFIX + key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        storage?.setItem(PREFIX + key, value);
      } catch {
        // 覚えられない環境: 開いている間だけ保つ
      }
    },
  };
}

/** ブラウザの localStorage。取り出すだけで例外になる環境では null */
export function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
