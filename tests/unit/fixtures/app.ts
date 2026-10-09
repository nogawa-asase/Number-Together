import { vi } from 'vitest';
import { AiHost } from '../../../src/app/AiHost';
import { PressBatcher } from '../../../src/app/PressBatcher';
import {
  SessionController,
  type SessionState,
} from '../../../src/app/SessionController';
import { DEFAULT_AI_PARAMS } from '../../../src/domain/ai/aiParams';
import { createRandom } from '../../../src/domain/ai/random';
import { DEFAULT_CONFIG } from '../../../src/domain/config/defaultConfig';
import type { GameConfig } from '../../../src/domain/config/types';
import type { FakeClock } from '../../../src/infra/memory/FakeClock';
import { InMemoryGameStore } from '../../../src/infra/memory/InMemoryGameStore';
import { memoryWorld, PLAY_END, PLAY_START, ROUND, START } from './memoryStore';
import { humanOf } from './players';

/** たまっている約束(Promise)の続きを、すべて動かす */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 時計を stepMs ずつ進め、そのたびに約束の続きを動かす。
 * advance を一度に大きく進めると、その間、書き込みの完了(約束の続き)が動かないため
 */
export async function advanceSettled(
  clock: FakeClock,
  ms: number,
  stepMs = 1_000
): Promise<void> {
  for (let done = 0; done < ms; done += stepMs) {
    clock.advance(Math.min(stepMs, ms - done));
    await settle();
  }
}

/**
 * 部屋に入って参加者になった人の PressBatcher を作る。
 * 時計とタイマーは同じ FakeClock(advance で、その間の送信が動く)
 */
export async function batcherWorld(
  startMs = PLAY_START,
  config: GameConfig = DEFAULT_CONFIG
) {
  const world = memoryWorld(startMs, config);
  const me = await world.connect();
  const roomId = await me.store.createRoom(me.uid);
  await me.store.addPlayer(roomId, ROUND, humanOf(me.uid));
  const onError = vi.fn();
  const batcher = new PressBatcher(
    {
      store: me.store,
      clock: world.clock,
      scheduler: world.clock,
      config,
      onError,
    },
    { roomId, roundId: ROUND, playerId: me.uid, playEndsAt: PLAY_END }
  );
  const number = () => world.server.numberOf(roomId, ROUND);
  const points = () => world.server.readPoints(me.uid, roomId, ROUND)[me.uid];
  const pulses = () => world.server.pulsesOf(roomId, ROUND)[me.uid];
  return { ...world, me, roomId, batcher, onError, number, points, pulses };
}

/**
 * 部屋に人間が何人か入り、最初の人が AI担当になった世界。
 * 人間は、まだ players にいない(join で、いまの回の参加者になる)
 */
export async function aiHostWorld(
  startMs = START,
  humanCount = 1,
  config: GameConfig = DEFAULT_CONFIG
) {
  const world = memoryWorld(startMs, config);
  const humans: Member[] = [];
  for (let i = 0; i < humanCount; i++) {
    humans.push(await world.connect());
  }
  const host = humans[0]!;
  const roomId = await host.store.createRoom(host.uid);
  for (const member of humans.slice(1)) {
    await member.store.tryEnterRoom(roomId, member.uid, config.roomCapacity);
  }
  await host.store.claimAiHost(roomId, ROUND, host.uid);
  const onError = vi.fn();

  /** その人のブラウザの AiHost を作る(乱数の種は固定) */
  function aiHostOf(member: Member, seed = 1) {
    return new AiHost(
      {
        store: member.store,
        clock: world.clock,
        scheduler: world.clock,
        config,
        aiParams: DEFAULT_AI_PARAMS,
        random: createRandom(seed),
        onError,
      },
      { roomId, uid: member.uid }
    );
  }

  /** その人を、いまの回の参加者にする */
  function join(member: Member, round = currentRound()) {
    return member.store.addPlayer(roomId, round, humanOf(member.uid));
  }

  function currentRound() {
    return String(Math.floor(world.clock.now() / 360_000));
  }

  const players = (round = currentRound()) =>
    world.server.playersOf(roomId, round);
  const ais = (round = currentRound()) =>
    players(round).filter((p) => p.kind === 'ai');
  const number = (round = currentRound()) =>
    world.server.numberOf(roomId, round);

  return {
    ...world,
    humans,
    host,
    roomId,
    onError,
    aiHostOf,
    join,
    players,
    ais,
    number,
  };
}

type Member = Awaited<ReturnType<ReturnType<typeof memoryWorld>['connect']>>;

/** SessionController を何人分か動かす世界。時計とタイマーは同じ FakeClock */
export function sessionWorld(
  startMs = START,
  config: GameConfig = DEFAULT_CONFIG
) {
  const world = memoryWorld(startMs, config);
  const onError = vi.fn();

  /** 新しい端末で SessionController を作る(まだ start しない) */
  function device(options: { deviceOnline?: () => boolean } = {}) {
    const store = new InMemoryGameStore(world.server);
    const session = new SessionController({
      store,
      clock: world.clock,
      scheduler: world.clock,
      config,
      deviceOnline: options.deviceOnline ?? (() => true),
      createAiHost: (seat) =>
        new AiHost(
          {
            store,
            clock: world.clock,
            scheduler: world.clock,
            config,
            aiParams: DEFAULT_AI_PARAMS,
            random: createRandom(1),
            onError,
          },
          seat
        ),
      onError,
    });
    const states: SessionState[] = [];
    session.onState((state) => states.push(state));
    return { store, session, states };
  }

  /** 登録済みの人の端末(プロフィールを先に保存しておく)。start して、入室まで進める */
  async function registered(name = 'ねこ') {
    const d = device();
    const { uid } = await d.store.signIn();
    await d.store.saveProfile(uid, {
      name,
      character: { hair: 'short', shirtColor: 'red', accessory: 'none' },
    });
    d.session.start();
    await settle();
    return { ...d, uid };
  }

  return { ...world, onError, device, registered };
}
