import { AiHost } from './app/AiHost';
import { detectLang, getLang, onLangChange, setLang } from './app/i18n/i18n';
import { RoundController } from './app/RoundController';
import { SessionController } from './app/SessionController';
import { DEFAULT_AI_PARAMS } from './domain/ai/aiParams';
import { createRandom } from './domain/ai/random';
import { DEFAULT_CONFIG } from './domain/config/defaultConfig';
import { QUICK_CONFIG } from './domain/config/quickConfig';
import type { GameConfig } from './domain/config/types';
import { connectFirebase } from './infra/firebase/firebaseApp';
import { FirebaseGameStore } from './infra/firebase/FirebaseGameStore';
import { FirebaseServerClock } from './infra/firebase/serverClock';
import {
  createTrafficMeter,
  NO_TRAFFIC_METER,
  type TrafficMeter,
} from './infra/firebase/TrafficMeter';
import { InMemoryGameStore } from './infra/memory/InMemoryGameStore';
import { InMemoryServer } from './infra/memory/InMemoryServer';
import { browserStorage, createPrefs } from './infra/prefs';
import type { GameStore } from './infra/store/GameStore';
import type { ServerClock } from './infra/store/ServerClock';
import { SystemClock } from './infra/timer/SystemClock';
import { SystemScheduler } from './infra/timer/SystemScheduler';
import { DomGameView } from './ui/DomGameView';
import { Motion } from './ui/motion';
import { createTrafficBadge } from './ui/TrafficBadge';
import './ui/styles/theme.css';
import './ui/styles/layout.css';
import './ui/styles/screens.css';
import './ui/styles/lobby.css';
import './ui/styles/stage.css';
import './ui/styles/graph.css';
import './ui/styles/play.css';
import './ui/styles/overlays.css';
import './ui/styles/result.css';
import './ui/styles/me.css';
import './ui/styles/motion.css';

/** どの GameStore・時計で動かすか */
interface Backend {
  readonly store: GameStore;
  readonly clock: ServerClock;
  readonly meter: TrafficMeter;
}

/**
 * Firebase の設定(VITE_FIREBASE_DATABASE_URL)があれば Firebase、なければ(または VITE_STORE=memory)
 * ローカルモード(メモリ上のサーバーと端末の時計。1人でAIと遊べる。ページを閉じるとデータは消える)
 */
function createBackend(config: GameConfig): Backend {
  const env = import.meta.env;
  const meter =
    env.VITE_TRAFFIC_METER === '1' ? createTrafficMeter() : NO_TRAFFIC_METER;
  if (env.VITE_STORE === 'memory' || !env.VITE_FIREBASE_DATABASE_URL) {
    const clock = new SystemClock();
    const store = new InMemoryGameStore(new InMemoryServer(clock, config));
    return { store, clock, meter };
  }
  const fb = connectFirebase({
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    databaseURL: env.VITE_FIREBASE_DATABASE_URL,
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
    useEmulator: env.VITE_USE_EMULATOR === 'true',
    // VITE_EMULATOR_HOST=page: 同じ Wi-Fi の実機で試すとき(npm run dev:lan)。開いたページの PC につなぐ
    emulatorHost:
      env.VITE_EMULATOR_HOST === 'page' ? location.hostname : undefined,
  });
  return {
    store: new FirebaseGameStore(fb, config, meter),
    clock: new FirebaseServerClock(fb.db),
    meter,
  };
}

/**
 * アプリの起動。各層を組み立てて、アプリを開始する(docs/repository-structure.md「main.ts」)。
 *
 * VITE_QUICK_CYCLE=1 のときは、短い周期(1周10秒)の設定で動かす(E2E と、手元の動作確認用)。
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

  const config =
    import.meta.env.VITE_QUICK_CYCLE === '1' ? QUICK_CONFIG : DEFAULT_CONFIG;
  const { store, clock, meter } = createBackend(config);
  const scheduler = new SystemScheduler();

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

  const motion = new Motion({
    get: () => prefs.get('reduceMotion') === '1',
    set: (on) => prefs.set('reduceMotion', on ? '1' : '0'),
  });

  view = new DomGameView({
    root,
    session,
    round,
    config,
    now: () => clock.now(),
    motion,
    canSaveRecords: browserStorage() !== null,
  });
  view.start();
  round.start();
  session.start();

  if (meter !== NO_TRAFFIC_METER) {
    reportTraffic(round, meter, root);
  }
}

/**
 * 通信量の計測(VITE_TRAFFIC_METER=1 のときだけ)。結果が出たとき(ゲーム終了の3秒後)に、
 * その回の合計をコンソールと、画面の右下に出す(docs/architecture.md「通信量の計測」)
 */
function reportTraffic(
  round: RoundController,
  meter: TrafficMeter,
  root: HTMLElement
): void {
  const badge = createTrafficBadge();
  root.append(badge.element);
  let reported: string | null = null;
  round.onView((view) => {
    if (view === null || view.result === null || reported === view.roundId) {
      return;
    }
    reported = view.roundId;
    const report = meter.report(view.roundId, view.players.length);
    console.info('通信量', report);
    badge.show(
      `${report.playerCount}p in ${report.inCount}/${(report.inBytes / 1024).toFixed(1)}KB out ${report.outCount}/${(report.outBytes / 1024).toFixed(1)}KB`
    );
  });
}

main();
