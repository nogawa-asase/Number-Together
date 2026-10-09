import { AiHost } from './app/AiHost';
import { detectLang, getLang, onLangChange, setLang } from './app/i18n/i18n';
import { RoundController } from './app/RoundController';
import { SessionController } from './app/SessionController';
import { DEFAULT_AI_PARAMS } from './domain/ai/aiParams';
import { createRandom } from './domain/ai/random';
import { DEFAULT_CONFIG } from './domain/config/defaultConfig';
import { InMemoryGameStore } from './infra/memory/InMemoryGameStore';
import { InMemoryServer } from './infra/memory/InMemoryServer';
import { browserStorage, createPrefs } from './infra/prefs';
import { SystemClock } from './infra/timer/SystemClock';
import { SystemScheduler } from './infra/timer/SystemScheduler';
import { DomGameView } from './ui/DomGameView';
import './ui/styles/theme.css';
import './ui/styles/layout.css';
import './ui/styles/screens.css';
import './ui/styles/lobby.css';
import './ui/styles/stage.css';
import './ui/styles/graph.css';
import './ui/styles/play.css';
import './ui/styles/overlays.css';
import './ui/styles/motion.css';

/**
 * アプリの起動。各層を組み立てて、アプリを開始する(docs/repository-structure.md「main.ts」)。
 *
 * いまは「ローカルモード」だけ: メモリ上のサーバーと、端末の時計で動かす(1人で、AIと遊べる)。
 * データは、ページを閉じると消える。FirebaseGameStore ができたら、設定があればそちらを使う。
 */
function main(): void {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (root === null) {
    throw new Error('#app が見つかりません');
  }

  // 言語: 覚えていればそれ、なければブラウザの言語設定から
  const prefs = createPrefs(browserStorage());
  const saved = prefs.get('lang');
  setLang(
    saved === 'ja' || saved === 'en' ? saved : detectLang(navigator.languages)
  );
  document.documentElement.lang = getLang();
  onLangChange((lang) => {
    prefs.set('lang', lang);
    document.documentElement.lang = lang;
  });

  const config = DEFAULT_CONFIG;
  const clock = new SystemClock();
  const scheduler = new SystemScheduler();
  const server = new InMemoryServer(clock, config);
  const store = new InMemoryGameStore(server);

  let view: DomGameView | null = null;
  const onError = (error: unknown) => {
    console.error(error);
    view?.showError();
  };

  const session = new SessionController({
    store,
    clock,
    scheduler,
    config,
    deviceOnline: () => navigator.onLine,
    createAiHost: (seat) =>
      new AiHost(
        {
          store,
          clock,
          scheduler,
          config,
          aiParams: DEFAULT_AI_PARAMS,
          random: createRandom(clock.now()),
          onError,
        },
        seat
      ),
    onError,
  });
  const round = new RoundController(
    { store, clock, scheduler, config, onError },
    session
  );

  view = new DomGameView({
    root,
    session,
    round,
    config,
    now: () => clock.now(),
  });
  view.start();
  round.start();
  session.start();
}

main();
