/**
 * Tests for the deterministic RNG utilities.
 */

import { describe, it, expect } from 'vitest';
import { mulberry32, hashSeed, shuffleInPlace } from './rng';

describe('mulberry32', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('yields different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('is reasonably uniform across quartiles', () => {
    const rng = mulberry32(42);
    const buckets = [0, 0, 0, 0];
    const n = 40000;
    for (let i = 0; i < n; i++) {
      buckets[Math.min(3, Math.floor(rng() * 4))]!++;
    }
    // Each bucket should be within ~15% of n/4.
    for (const count of buckets) {
      expect(count).toBeGreaterThan(n / 4 - n * 0.05);
      expect(count).toBeLessThan(n / 4 + n * 0.05);
    }
  });
});

describe('hashSeed', () => {
  it('is deterministic', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
  });

  it('is order-sensitive', () => {
    expect(hashSeed(1, 2)).not.toBe(hashSeed(2, 1));
  });

  it('produces different seeds for adjacent inputs', () => {
    expect(hashSeed(100)).not.toBe(hashSeed(101));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed(7, 13);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('shuffleInPlace', () => {
  it('is deterministic for a given rng seed', () => {
    const base = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const a = shuffleInPlace([...base], mulberry32(5));
    const b = shuffleInPlace([...base], mulberry32(5));
    expect(a).toEqual(b);
  });

  it('preserves all elements (is a permutation)', () => {
    const base = [10, 20, 30, 40, 50];
    const shuffled = shuffleInPlace([...base], mulberry32(77));
    expect([...shuffled].sort((x, y) => x - y)).toEqual(base);
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffleInPlace([], mulberry32(1))).toEqual([]);
    expect(shuffleInPlace([42], mulberry32(1))).toEqual([42]);
  });
});
