import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../../../src/domain/config/defaultConfig';

/**
 * セキュリティルール(database.rules.json)は、設定ファイルを読めないので、同じ値を書いている。
 * 値の対応(docs/architecture.md「データベースの配置とセキュリティルール」)が崩れていないかを確かめる。
 */
const rulesText = readFileSync('database.rules.json', 'utf8');
const rules = JSON.parse(rulesText) as RulesNode;

interface RulesNode {
  readonly [key: string]: string | boolean | RulesNode;
}

function ruleAt(...path: string[]): string {
  let node: string | boolean | RulesNode = rules;
  for (const key of path) {
    if (typeof node !== 'object') {
      throw new Error(`ルールに ${path.join('/')} がありません`);
    }
    node = node[key];
  }
  if (typeof node !== 'string') {
    throw new Error(`ルールの ${path.join('/')} が文字列ではありません`);
  }
  return node;
}

/** ルールの式に出てくる数値を、すべて取り出す */
function numbersIn(expression: string): number[] {
  return [...expression.matchAll(/\d+/g)].map((match) => Number(match[0]));
}

const { gatherMs, playMs, resultMs, pointsGraceMs } = DEFAULT_CONFIG;
const cycleMs = gatherMs + playMs + resultMs;
const round = ['rules', 'rooms', '$room', 'rounds', '$round'];

describe('セキュリティルールと設定値の一致', () => {
  it('数字は、いまの回のゲーム中(gatherMs 〜 gatherMs + playMs)だけ書ける', () => {
    const write = ruleAt(...round, 'number', '.write');
    expect(write).toContain(`now % ${cycleMs} >= ${gatherMs}`);
    expect(write).toContain(`now % ${cycleMs} < ${gatherMs + playMs}`);
    expect(write).toContain(`(now - now % ${cycleMs}) / ${cycleMs}`);
  });

  it('1回の数字の変化の上限は、maxDeltaPerWrite と同じ', () => {
    const validate = ruleAt(...round, 'number', '.validate');
    expect(validate).toContain(`<= ${DEFAULT_CONFIG.maxDeltaPerWrite}`);
    expect(validate).toContain(`>= -${DEFAULT_CONFIG.maxDeltaPerWrite}`);
  });

  it('ポイントは、終了の pointsGraceMs 後まで書けて、そのあとは他の人も読める', () => {
    const graceEnd = gatherMs + playMs + pointsGraceMs;
    expect(ruleAt(...round, 'points', '$playerId', '.write')).toContain(
      `now % ${cycleMs} < ${graceEnd}`
    );
    expect(ruleAt(...round, 'points', '$playerId', '.read')).toContain(
      `now % ${cycleMs} >= ${graceEnd}`
    );
  });

  it('部屋の人数の上限は、roomCapacity と同じ', () => {
    const validate = ruleAt(
      'rules',
      'rooms',
      '$room',
      'memberCount',
      '.validate'
    );
    expect(validate).toContain(
      `newData.val() <= ${DEFAULT_CONFIG.roomCapacity}`
    );
  });

  it('名前の長さの粗い上限は、nameMaxUnits と同じ', () => {
    const validate = ruleAt(
      'rules',
      'users',
      '$uid',
      'profile',
      'name',
      '.validate'
    );
    expect(validate).toContain(`length <= ${DEFAULT_CONFIG.nameMaxUnits}`);
  });

  it('ルールの中の、1周の長さは、すべて設定値から計算した値と同じ', () => {
    // 1周の長さに見える6桁の数値(100000以上)は、すべて、1周・ゲーム終了・猶予の終わりのどれか
    const known = new Set([
      cycleMs,
      gatherMs + playMs,
      gatherMs + playMs + pointsGraceMs,
    ]);
    const large = numbersIn(rulesText).filter((n) => n >= 100_000);
    expect(large.length).toBeGreaterThan(0);
    expect(large.filter((n) => !known.has(n))).toEqual([]);
  });
});
