/**
 * Deterministic pseudo-random utilities for TaaraNight.
 *
 * Everything the nightly puzzle needs must be reproducible: the same night
 * (and difficulty) must always produce the exact same puzzle. We therefore
 * never use Math.random() for puzzle content — instead we seed a small,
 * fast PRNG (mulberry32) with a hash of the inputs.
 */

/**
 * mulberry32 — a compact, well-distributed 32-bit PRNG.
 * Returns a function that yields floats in the half-open range [0, 1).
 * Given the same seed it always yields the same sequence.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * FNV-1a based hash that folds any number of integer "parts" into a single
 * 32-bit seed. Order matters: hashSeed(1, 2) !== hashSeed(2, 1). This lets us
 * derive decorrelated seeds from e.g. (nightNumber, difficultyCode).
 */
export function hashSeed(...parts: number[]): number {
  let h = 2166136261 >>> 0; // FNV offset basis
  for (const part of parts) {
    let p = part | 0;
    // Mix all four bytes so nearby inputs produce very different seeds.
    for (let i = 0; i < 4; i++) {
      h ^= p & 0xff;
      h = Math.imul(h, 16777619) >>> 0; // FNV prime
      p >>>= 8;
    }
  }
  return h >>> 0;
}

/**
 * In-place Fisher–Yates shuffle driven by a seeded RNG. Deterministic for a
 * given rng sequence. Returns the same array for convenience.
 */
export function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}
