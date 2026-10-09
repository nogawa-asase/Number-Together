import type { Cancel, Scheduler } from '../store/Scheduler';

/** 本物のタイマー(setTimeout・setInterval)を使う Scheduler */
export class SystemScheduler implements Scheduler {
  after(ms: number, callback: () => void): Cancel {
    const handle = setTimeout(callback, ms);
    return () => clearTimeout(handle);
  }

  every(ms: number, callback: () => void): Cancel {
    const handle = setInterval(callback, ms);
    return () => clearInterval(handle);
  }
}
