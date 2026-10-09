import { onLangChange } from '../app/i18n/i18n';
import type { RoundController } from '../app/RoundController';
import type { SessionController, SessionState } from '../app/SessionController';
import type { GameConfig } from '../domain/config/types';
import type { CharacterSpec } from '../domain/types';
import type { Screen } from './dom';
import { createLanguageSwitch } from './LanguageSwitch';
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

  constructor(private readonly deps: DomGameViewDeps) {}

  start(): void {
    const { root, session } = this.deps;
    root.append(createLanguageSwitch());
    session.onState((state) => {
      this.state = state;
      this.render();
    });
    onLangChange(() => this.render());
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
