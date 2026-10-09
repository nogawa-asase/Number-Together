import { describe, expect, it } from 'vitest';
import {
  type CaseSummary,
  formatTable,
  type RoundResult,
  type SimCase,
  simulateAiRound,
  summarize,
} from './aiRound';

const ROUNDS = Number(process.env.SIM_ROUNDS ?? 40);

const SIZES = [5, 10, 20];

/** 本番と同じ選び方(性格を、重ならないように選ぶ)。成功率の張り付きを確かめる */
const MIXED: readonly SimCase[] = SIZES.map((aiCount) => ({
  label: `${aiCount}人・混ぜる`,
  aiCount,
  personalities: null,
}));

/**
 * 偏った部屋(参考)。本番の選び方では起きないが、性格の効き方を見るために表に出す。
 * 偏っているので、成功率が0%や100%に寄るのは正常(張り付きは確かめない)
 */
const BIASED: readonly SimCase[] = SIZES.flatMap((aiCount) => [
  {
    label: `${aiCount}人・がめつい多め`,
    aiCount,
    personalities: ['greedy', 'greedy', 'lastSpurt', 'moody', 'balancer'],
  },
  {
    label: `${aiCount}人・慎重派多め`,
    aiCount,
    personalities: [
      'balancer',
      'balancer',
      'perfectionist',
      'perfectionist',
      'moody',
    ],
  },
]);

const CASES = [...MIXED, ...BIASED];

/** 組み合わせごとに、種 1〜ROUNDS で回す */
async function runAll() {
  const results = new Map<SimCase, RoundResult[]>();
  for (const simCase of CASES) {
    const list: RoundResult[] = [];
    for (let seed = 1; seed <= ROUNDS; seed++) {
      list.push(await simulateAiRound(simCase, seed));
    }
    results.set(simCase, list);
  }
  return results;
}

describe('AIだけの回', async () => {
  const results = await runAll();
  const summaries: CaseSummary[] = [...results].map(([simCase, list]) =>
    summarize(simCase.label, list)
  );
  console.log(`\nAIだけの回(各 ${ROUNDS} 回)\n\n${formatTable(summaries)}\n`);

  it('どの回も、想定外のエラーなく、最後まで進む', () => {
    for (const list of results.values()) {
      expect(list).toHaveLength(ROUNDS);
      for (const r of list) {
        expect(r.errors).toEqual([]);
        expect(r.rejections).toBe(0);
      }
    }
  });

  it('最終の数字とポイントが整数で、ポイントは0以上', () => {
    for (const [simCase, list] of results) {
      for (const r of list) {
        expect(Number.isSafeInteger(r.finalNumber)).toBe(true);
        expect(r.ais).toHaveLength(simCase.aiCount);
        for (const ai of r.ais) {
          expect(Number.isSafeInteger(ai.points)).toBe(true);
          expect(ai.points).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('本番と同じ選び方の組み合わせごとに、成功率が0%にも100%にも張り付いていない', () => {
    for (const s of summaries.slice(0, MIXED.length)) {
      expect(s.successRate, s.label).toBeGreaterThan(0);
      expect(s.successRate, s.label).toBeLessThan(1);
    }
  });

  it('乱数の種が同じなら、同じ結果になる', async () => {
    const simCase = MIXED[0]!;
    expect(await simulateAiRound(simCase, 3)).toEqual(results.get(simCase)![2]);
  });
});
