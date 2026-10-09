/** 「動きをへらす」のスイッチの値を覚える口(main.ts が、ブラウザに覚える形で渡す) */
export interface MotionPref {
  get(): boolean;
  set(on: boolean): void;
}

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * 「動きをへらす」。端末の設定(prefers-reduced-motion)か、自分の画面のスイッチの
 * どちらかが入っていれば、<html> に .reduce-motion を付ける(動きの CSS は、このクラスで止める)。
 */
export class Motion {
  private readonly media: MediaQueryList | null;

  constructor(
    private readonly pref: MotionPref,
    private readonly root: HTMLElement = document.documentElement
  ) {
    this.media = typeof matchMedia === 'function' ? matchMedia(QUERY) : null;
    this.media?.addEventListener('change', () => this.apply());
    this.apply();
  }

  /** スイッチが入っているか */
  switchOn(): boolean {
    return this.pref.get();
  }

  setSwitch(on: boolean): void {
    this.pref.set(on);
    this.apply();
  }

  private apply(): void {
    const reduced = this.pref.get() || this.media?.matches === true;
    this.root.classList.toggle('reduce-motion', reduced);
  }
}
