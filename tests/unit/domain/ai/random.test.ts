import { describe, expect, it } from 'vitest';
import { createRandom } from '../../../../src/domain/ai/random';

function take(seed: number, count: number): number[] {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => random.next());
}

describe('createRandom', () => {
  it('同じ種なら、同じ並びを返す', () => {
    expect(take(42, 100)).toEqual(take(42, 100));
  });

  it('違う種なら、違う並びを返す', () => {
    expect(take(1, 10)).not.toEqual(take(2, 10));
  });

  it('値は、0以上1未満', () => {
    for (const value of take(7, 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('値は、0〜1に偏りなく散らばる(10個の区間に、ほぼ均等)', () => {
    const buckets = Array.from({ length: 10 }, () => 0);
    for (const value of take(123, 100_000)) {
      buckets[Math.floor(value * 10)]! += 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(9_500);
      expect(count).toBeLessThan(10_500);
    }
  });

  it('種は32ビットに丸める(負の種や大きな種でも動く)', () => {
    expect(take(-1, 5)).toEqual(take(0xffffffff, 5));
  });
});
