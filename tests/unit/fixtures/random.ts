import type { Random } from '../../../src/domain/ai/random';

/**
 * 決めた値を、順に返す乱数。最後まで返したら、先頭に戻る。
 * AIの手の分岐を、1つずつ確かめるのに使う
 */
export function fixedRandom(...values: number[]): Random {
  let index = 0;
  return {
    next(): number {
      const value = values[index % values.length] ?? 0;
      index += 1;
      return value;
    },
  };
}
