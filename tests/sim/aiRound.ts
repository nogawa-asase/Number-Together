import { AiHost } from '../../src/app/AiHost';
import { type AiParams, DEFAULT_AI_PARAMS } from '../../src/domain/ai/aiParams';
import { createRandom } from '../../src/domain/ai/random';
import { DEFAULT_CONFIG } from '../../src/domain/config/defaultConfig';
import type { GameConfig } from '../../src/domain/config/types';
import { judge } from '../../src/domain/judge/judge';
import { roundClockAt, roundId } from '../../src/domain/schedule/roundClockAt';
import { targetFor } from '../../src/domain/targets/targetFor';
import type { AiPersonality, Outcome } from '../../src/domain/types';
import { FakeClock } from '../../src/infra/memory/FakeClock';
import { InMemoryGameStore } from '../../src/infra/memory/InMemoryGameStore';
import { InMemoryServer } from '../../src/infra/memory/InMemoryServer';

/** シミュレーションの1つの組み合わせ */
export interface SimCase {
  readonly label: string;
  readonly aiCount: number;
  /** AIの性格の並び(AIの数より短ければ、くり返す)。null なら、本番と同じ選び方 */
  readonly personalities: readonly AiPersonality[] | null;
}

/** 1回分の結果 */
export interface RoundResult {
  readonly finalNumber: number;
  readonly target: number;
  readonly outcome: Outcome;
  readonly ais: readonly { personality: AiPersonality; points: number }[];
  readonly errors: readonly unknown[]; // 想定外のエラー
  readonly rejections: number; // ルールに拒否された書き込みの数
}

const START = 4_928_211 * 360_000; // ある回の、集合の始め

/**
 * AIだけの回を、集合の始めから、ポイントの猶予の終わりまで動かす。
 *
 * AI担当の人間を1人つなぐが、players には入れない(押さない)。AiHost は担当の自分を人間として
 * 数えるので、aiFillTo を AIの数 + 1 にすると、AIだけが aiCount 人そろう。
 * 時計は一度に進める。途中のポイントの書き込みは間引かれるが、PressBatcher が終了時に最後の値を書く。
 */
export async function simulateAiRound(
  simCase: SimCase,
  seed: number,
  params: AiParams = DEFAULT_AI_PARAMS,
  baseConfig: GameConfig = DEFAULT_CONFIG
): Promise<RoundResult> {
  const config = { ...baseConfig, aiFillTo: simCase.aiCount + 1 };
  const clock = new FakeClock(START);
  const server = new InMemoryServer(clock, config);
  const store = new InMemoryGameStore(server);
  const { uid } = await store.signIn();
  const roomId = await store.createRoom(uid);
  const round = roundId(roundClockAt(START, config).roundIndex);
  await store.claimAiHost(roomId, round, uid);
  overridePersonalities(store, simCase.personalities);

  const errors: unknown[] = [];
  const host = new AiHost(
    {
      store,
      clock,
      scheduler: clock,
      config,
      aiParams: params,
      random: createRandom(seed),
      onError: (error) => errors.push(error),
    },
    { roomId, uid }
  );
  host.start();
  const { playEndsAt } = roundClockAt(START, config);
  clock.advance(playEndsAt + config.pointsGraceMs - START);
  await new Promise((resolve) => setTimeout(resolve, 0)); // 約束の続きを動かす
  host.stop();

  const players = server.playersOf(roomId, round);
  const finalNumber = server.numberOf(roomId, round);
  const target = targetFor(players.length, config);
  const points = server.readPoints(uid, roomId, round);
  return {
    finalNumber,
    target,
    outcome: judge(finalNumber, target, config).outcome,
    ais: players.map((p) => ({
      personality: p.personality!,
      points: points[p.id] ?? 0,
    })),
    errors,
    rejections: server.rejections.length,
  };
}

/** 担当の窓口の addPlayer を包み、AIの性格を、指定の並びに書き換える */
function overridePersonalities(
  store: InMemoryGameStore,
  personalities: readonly AiPersonality[] | null
): void {
  if (personalities === null) {
    return;
  }
  const add = store.addPlayer.bind(store);
  let next = 0;
  store.addPlayer = (roomId, round, player) =>
    add(roomId, round, {
      ...player,
      personality: personalities[next++ % personalities.length]!,
    });
}

/** 組み合わせごとの集計 */
export interface CaseSummary {
  readonly label: string;
  readonly rounds: number;
  readonly successRate: number; // 成功 + ぴったり成功
  readonly perfectRate: number;
  readonly ratio: { mean: number; min: number; max: number }; // 最終の数字 / 目標
  readonly points: Readonly<
    Partial<
      Record<
        AiPersonality,
        { mean: number; min: number; median: number; max: number }
      >
    >
  >;
}

/** 1つの組み合わせの結果を集計する */
export function summarize(
  label: string,
  results: readonly RoundResult[]
): CaseSummary {
  const n = results.length;
  const count = (outcomes: Outcome[]) =>
    results.filter((r) => outcomes.includes(r.outcome)).length;
  const ratios = results.map((r) => r.finalNumber / r.target);

  const byPersonality = new Map<AiPersonality, number[]>();
  for (const r of results) {
    for (const ai of r.ais) {
      const list = byPersonality.get(ai.personality) ?? [];
      list.push(ai.points);
      byPersonality.set(ai.personality, list);
    }
  }
  const points = Object.fromEntries(
    [...byPersonality].map(([personality, list]) => {
      const sorted = [...list].sort((a, b) => a - b);
      return [
        personality,
        {
          mean: mean(sorted),
          min: sorted[0]!,
          median: sorted[Math.floor(sorted.length / 2)]!,
          max: sorted.at(-1)!,
        },
      ];
    })
  );

  return {
    label,
    rounds: n,
    successRate: count(['success', 'perfect']) / n,
    perfectRate: count(['perfect']) / n,
    ratio: {
      mean: mean(ratios),
      min: Math.min(...ratios),
      max: Math.max(...ratios),
    },
    points,
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fixed = (v: number) => v.toFixed(2);

/** 集計を、ログに出す表にする */
export function formatTable(summaries: readonly CaseSummary[]): string {
  const lines = [
    '| 組み合わせ | 回数 | 成功率 | ぴったり率 | 目標比(平均・最小〜最大) |',
    '| --- | --- | --- | --- | --- |',
    ...summaries.map(
      (s) =>
        `| ${s.label} | ${s.rounds} | ${pct(s.successRate)} | ${pct(s.perfectRate)} | ` +
        `${fixed(s.ratio.mean)}(${fixed(s.ratio.min)}〜${fixed(s.ratio.max)}) |`
    ),
    '',
    '| 組み合わせ | 性格 | ポイント(平均・最小・中央・最大) |',
    '| --- | --- | --- |',
    ...summaries.flatMap((s) =>
      Object.entries(s.points).map(
        ([personality, p]) =>
          `| ${s.label} | ${personality} | ${Math.round(p.mean)}・${p.min}・${p.median}・${p.max} |`
      )
    ),
  ];
  return lines.join('\n');
}
