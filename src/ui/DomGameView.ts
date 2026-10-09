import { onLangChange, t } from '../app/i18n/i18n';
import type { RoundController } from '../app/RoundController';
import type { SessionController, SessionState } from '../app/SessionController';
import type { GameConfig } from '../domain/config/types';
import type { CharacterSpec } from '../domain/types';
import { html, type Screen, text } from './dom';
import { createLanguageSwitch } from './LanguageSwitch';
import type { Motion } from './motion';
import { MyPageScreen } from './screens/MyPageScreen';
import { BusyScreen } from './screens/BusyScreen';
import { MessageScreen } from './screens/MessageScreen';
import { OfflineScreen } from './screens/OfflineScreen';
import { RoomScreen } from './screens/RoomScreen';
import { SetupScreen } from './screens/SetupScreen';
import { WaitScreen } from './screens/WaitScreen';

/** DomGameView が使うもの */
export interface DomGameViewDeps {
  readonly root: HTMLElement;
  readonly session: SessionController;
  readonly round: RoundController;
  readonly config: GameConfig;
  readonly now: () => number; // サーバー時刻
  readonly motion: Motion; // 「動きをへらす」
}

/**
 * 画面の切り替え(docs/functional-design.md「UI層」「画面遷移図」)。
 *
 * SessionController の状態で画面を選び、言語が変わったら、いまの画面を作り直す。
 * 部屋の中(集合中・プレイ中・結果発表)は、RoundController の view で描く。
 */
export class DomGameView {
  private screen: Screen | null = null;
  private state: SessionState | null = null;
  private fatal = false;
  private setupDraft: { name: string; character: CharacterSpec } | null = null;
  private overlay: Screen | null = null; // 自分の画面(どの画面の上にも重ねる)
  private overlayKind: 'me' | 'edit' | null = null;
  private readonly meButton = html<HTMLButtonElement>(
    '<button type="button" class="lang-switch" hidden></button>'
  );

  constructor(private readonly deps: DomGameViewDeps) {}

  start(): void {
    const { root, session } = this.deps;
    const buttons = html('<div class="top-buttons"></div>');
    buttons.append(this.meButton, createLanguageSwitch());
    root.append(buttons);
    this.meButton.addEventListener('click', () => this.openOverlay('me'));
    session.onState((state) => {
      this.state = state;
      this.render();
    });
    onLangChange(() => {
      this.render();
      if (this.overlayKind !== null) {
        this.openOverlay(this.overlayKind);
      }
    });
  }

  /** 想定外のエラー: 画面全体を止め、再読み込みのボタンを出す */
  showError(): void {
    this.fatal = true;
    this.render();
  }

  private render(): void {
    const { root } = this.deps;
    if (this.screen instanceof SetupScreen) {
      this.setupDraft = this.screen.snapshot(); // 言語を切り替えても、入力を残す
    }
    this.screen?.dispose();
    this.screen?.element.remove();
    this.screen = this.create();
    root.prepend(this.screen.element);
    // 「じぶん」は、登録が済んでから(部屋の中・待機中)
    const kind = this.state?.kind;
    this.meButton.hidden =
      this.fatal || (kind !== 'inRoom' && kind !== 'waiting');
    text(this.meButton, t('me.open'));
    if (this.meButton.hidden) {
      this.closeOverlay();
    }
  }

  /** 18 自分の画面と、そこから開く「名前・キャラをかえる」 */
  private openOverlay(kind: 'me' | 'edit'): void {
    const { session, config, motion, root } = this.deps;
    const profile = session.profile();
    const uid = session.uid();
    if (profile === null || uid === null) {
      return;
    }
    this.closeOverlay();
    if (kind === 'me') {
      const page = new MyPageScreen({
        uid,
        profile,
        config,
        reduceMotion: motion.switchOn(),
        onReduceMotion: (on) => motion.setSwitch(on),
        onEdit: () => this.openOverlay('edit'),
        onClose: () => this.closeOverlay(),
      });
      void session.refreshStats().then((stats) => {
        if (this.overlay === page) {
          page.setStats(stats ?? session.stats());
        }
      });
      this.overlay = page;
    } else {
      const editor = new SetupScreen({
        uid,
        config,
        initial: profile,
        onDecide: async (name, character) => {
          try {
            const saved = (await session.updateProfile(name, character)).ok;
            if (saved) {
              this.openOverlay('me');
            }
            return saved;
          } catch {
            return false;
          }
        },
        onClose: () => this.openOverlay('me'),
      });
      editor.element.classList.add('overlay-screen');
      this.overlay = editor;
    }
    this.overlayKind = kind;
    root.append(this.overlay.element);
  }

  private closeOverlay(): void {
    this.overlay?.dispose();
    this.overlay?.element.remove();
    this.overlay = null;
    this.overlayKind = null;
  }

  private create(): Screen {
    const { session, round, config, now } = this.deps;
    if (this.fatal) {
      return new MessageScreen('error.title', 'error.lead', {
        label: 'error.reload',
        onClick: () => location.reload(),
      });
    }
    const state = this.state ?? { kind: 'connecting' };
    switch (state.kind) {
      case 'connecting':
      case 'entering':
        return new MessageScreen('connecting.title', null);
      case 'busy':
        return new BusyScreen(config.retryMs, () => session.retryNow());
      case 'offline':
      case 'reconnecting':
        return new OfflineScreen(state.attempts, () => session.retryNow());
      case 'needsProfile':
        return new SetupScreen({
          uid: session.uid()!,
          config,
          initial: this.setupDraft,
          onDecide: async (name, character) => {
            try {
              return (await session.register(name, character)).ok;
            } catch {
              return false; // 保存できなかった: もう一度押してもらう
            }
          },
        });
      case 'waiting':
        return new WaitScreen(state.reason, state.until, now);
      case 'inRoom':
        return new RoomScreen(round, session.uid()!, config, now);
    }
  }
}
