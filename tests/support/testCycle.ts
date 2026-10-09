import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG } from '../../src/domain/config/defaultConfig';
import type { GameConfig } from '../../src/domain/config/types';
import { roundClockAt, roundId } from '../../src/domain/schedule/roundClockAt';
import type { Phase } from '../../src/domain/types';

/**
 * エミュレータを使うテスト(ルール・結合・E2E)の、短い周期の設定値。
 *
 * ルールは、サーバーの時刻で段階を決めるので、本物の周期(6分)のままでは、段階を待つのに数分かかる。
 * 1周を10秒にして、ルールの時刻の数値も、同じ値に置き換えて読み込ませる(式は、そのまま)。
 */
export const TEST_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  gatherMs: 2_000,
  playMs: 6_000,
  resultMs: 2_000,
  pointsGraceMs: 500,
  joinCutoffMs: 1_000,
  bonusDurationMs: 2_000,
  startCountdownMs: 1_000,
  finalCountdownMs: 1_000,
};

const CYCLE = TEST_CONFIG.gatherMs + TEST_CONFIG.playMs + TEST_CONFIG.resultMs;

/**
 * ルールの中の時刻の数値と、それぞれが出てくる回数(docs/architecture.md「データベースの配置とセキュリティルール」)。
 * 回数が変わったら(ルールを書き足したら)、置き換え漏れがないか、ここも直す
 */
const TIME_CONSTANTS = [
  {
    value: 360_000,
    count: 19,
    replace: CYCLE,
  },
  {
    value: 333_000,
    count: 2,
    replace:
      TEST_CONFIG.gatherMs + TEST_CONFIG.playMs + TEST_CONFIG.pointsGraceMs,
  },
  {
    value: 330_000,
    count: 2,
    replace: TEST_CONFIG.gatherMs + TEST_CONFIG.playMs,
  },
  { value: 30_000, count: 3, replace: TEST_CONFIG.gatherMs },
] as const;

/** 前後が数字でない、その数値だけに合う正規表現 */
function exactly(value: number): RegExp {
  return new RegExp(`(?<![0-9])${value}(?![0-9])`, 'g');
}

/**
 * database.rules.json の時刻の数値を、TEST_CONFIG の値に置き換えたルール(文字列)。
 *
 * @throws Error - 数値の出てくる回数が、決めた回数と違うとき(ルールが変わって、置き換え漏れがありうる)
 */
export function scaledRules(path = 'database.rules.json'): string {
  let rules = readFileSync(path, 'utf8');
  for (const { value, count, replace } of TIME_CONSTANTS) {
    const found = rules.match(exactly(value))?.length ?? 0;
    if (found !== count) {
      throw new Error(
        `ルールの ${value} が ${found} 回あります(${count} 回のはず)。tests/support/testCycle.ts を直してください`
      );
    }
    rules = rules.replace(exactly(value), String(replace));
  }
  return rules;
}

/** いまの回の id(ルールと同じ計算) */
export function currentRoundId(now = Date.now()): string {
  return roundId(roundClockAt(now, TEST_CONFIG).roundIndex);
}

/** 段階を細かく分けたもの(ポイントの猶予を、結果発表から分ける) */
export type TestPhase = Phase | 'grace';

function phaseAt(now: number): { phase: TestPhase; remaining: number } {
  const clock = roundClockAt(now, TEST_CONFIG);
  const graceEnd = clock.playEndsAt + TEST_CONFIG.pointsGraceMs;
  if (clock.phase === 'result' && now < graceEnd) {
    return { phase: 'grace', remaining: graceEnd - now };
  }
  if (clock.phase === 'result') {
    return { phase: 'result', remaining: clock.nextRoundStartsAt - now };
  }
  return { phase: clock.phase, remaining: clock.phaseEndsAt - now };
}

/**
 * ほしい段階に入り、その段階の残りが atLeastMs 以上になるまで待つ(エミュレータも、同じ機械の時計を使う)。
 *
 * @returns 待ち終わった時刻
 */
export async function waitFor(
  phase: TestPhase,
  atLeastMs = 800
): Promise<number> {
  for (;;) {
    const now = Date.now();
    const at = phaseAt(now);
    if (at.phase === phase && at.remaining >= atLeastMs) {
      return now;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
