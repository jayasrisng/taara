import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../shared/rng';
import { chirpsPerCall, cricketGap } from './ambience';

describe('cricketGap', () => {
  it('leaves between five and sixteen seconds of silence', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const gap = cricketGap(rng);
      expect(gap).toBeGreaterThanOrEqual(5);
      expect(gap).toBeLessThan(16);
    }
  });

  it('gives every night the same crickets', () => {
    const a = mulberry32(0x2c17);
    const b = mulberry32(0x2c17);
    expect(cricketGap(a)).toBe(cricketGap(b));
  });
});

describe('chirpsPerCall', () => {
  it('calls two, three or four times', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const chirps = chirpsPerCall(rng);
      expect(Number.isInteger(chirps)).toBe(true);
      seen.add(chirps);
    }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
});
