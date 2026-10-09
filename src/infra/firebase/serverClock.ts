import { type Database, onValue, ref } from 'firebase/database';
import type { Unsubscribe } from '../store/GameStore';
import type { ServerClock } from '../store/ServerClock';
import { paths } from './paths';

/**
 * サーバー時刻(docs/architecture.md「時計の同期」)。
 * データベースの .info/serverTimeOffset を購読し、now() = Date.now() + offset を返す。
 */
export class FirebaseServerClock implements ServerClock {
  private offset = 0;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: Unsubscribe;

  constructor(db: Database) {
    this.unsubscribe = onValue(ref(db, paths.serverTimeOffset()), (snap) => {
      const value: unknown = snap.val();
      const offset =
        typeof value === 'number' && Number.isFinite(value) ? value : 0;
      if (offset !== this.offset) {
        this.offset = offset;
        for (const listener of [...this.listeners]) {
          listener();
        }
      }
    });
  }

  now(): number {
    return Math.round(Date.now() + this.offset);
  }

  onOffsetChange(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.unsubscribe();
  }
}
