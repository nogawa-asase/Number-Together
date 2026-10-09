import { type FirebaseApp, initializeApp } from 'firebase/app';
import {
  type Auth,
  browserLocalPersistence,
  connectAuthEmulator,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth';
import {
  connectDatabaseEmulator,
  type Database,
  getDatabase,
} from 'firebase/database';

/** Firebase の接続の設定(docs/architecture.md「Firebase の構成」) */
export interface FirebaseSettings {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly databaseURL: string;
  readonly projectId: string;
  readonly appId: string;
  /** true なら、認証(9099)とデータベース(9000)のエミュレータにつなぐ */
  readonly useEmulator: boolean;
  /** エミュレータのホスト(既定 127.0.0.1) */
  readonly emulatorHost?: string;
}

/** 初期化した Firebase */
export interface FirebaseHandles {
  readonly app: FirebaseApp;
  readonly auth: Auth;
  readonly db: Database;
}

/**
 * Firebase を初期化する。
 *
 * 匿名認証の ID は、ブラウザの保存領域に覚える。保存できない環境(itch.io の iframe など)では、
 * 開いている間だけ覚える(docs/architecture.md「匿名認証の保持」)。
 *
 * @param settings - 接続の設定
 * @param name - アプリの名前(結合テストで、1つのプロセスに何人分もつなぐとき、人ごとに変える)
 */
export function connectFirebase(
  settings: FirebaseSettings,
  name?: string
): FirebaseHandles {
  const { useEmulator, emulatorHost = '127.0.0.1', ...config } = settings;
  const app = initializeApp(config, name);
  const auth = initializeAuth(app, {
    persistence:
      typeof window === 'undefined'
        ? inMemoryPersistence
        : [browserLocalPersistence, inMemoryPersistence],
  });
  const db = getDatabase(app);
  if (useEmulator) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, {
      disableWarnings: true,
    });
    connectDatabaseEmulator(db, emulatorHost, 9000);
  }
  return { app, auth, db };
}
