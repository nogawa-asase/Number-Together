import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage, createPrefs } from '../../../src/infra/prefs';

/** テスト用の localStorage */
function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefs', () => {
  it('storage に覚え、次に作ったときも読める', () => {
    const storage = fakeStorage();
    createPrefs(storage).set('lang', 'en');
    expect(createPrefs(storage).get('lang')).toBe('en');
    expect(storage.getItem('number-together.lang')).toBe('en');
  });

  it('覚えていなければ null', () => {
    expect(createPrefs(fakeStorage()).get('lang')).toBeNull();
  });

  it('storage がなければ、開いている間だけ保つ', () => {
    const prefs = createPrefs(null);
    prefs.set('reduceMotion', '1');
    expect(prefs.get('reduceMotion')).toBe('1');
  });

  it('storage が例外を出しても、開いている間は保つ', () => {
    const storage = fakeStorage();
    storage.getItem = () => {
      throw new Error('使えない');
    };
    storage.setItem = () => {
      throw new Error('使えない');
    };
    const prefs = createPrefs(storage);
    expect(prefs.get('lang')).toBeNull();
    prefs.set('lang', 'en');
    expect(prefs.get('lang')).toBe('en');
  });

  it('書き込みだけ失敗する storage でも、開いている間は保つ', () => {
    const storage = fakeStorage();
    storage.setItem = () => {
      throw new Error('いっぱい');
    };
    const prefs = createPrefs(storage);
    prefs.set('lang', 'en');
    expect(prefs.get('lang')).toBe('en');
  });

  it('browserStorage: localStorage があれば返し、取り出すと例外になる環境では null', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    expect(browserStorage()).toBe(storage);
    vi.stubGlobal('localStorage', undefined);
    expect(browserStorage()).toBeNull();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('使えない');
      },
    });
    expect(browserStorage()).toBeNull();
    Reflect.deleteProperty(globalThis, 'localStorage');
  });
});
