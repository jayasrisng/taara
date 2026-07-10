import { describe, expect, it } from 'vitest';
import { keys, nightScore, nightScoreParts } from './keys';

describe('keys', () => {
  it('namespaces every key under tn:', () => {
    const all = [
      keys.nightStars(3),
      keys.nightPlayers(3),
      keys.result(3, 'stargazer'),
      keys.jwala('stargazer'),
      keys.sky('stargazer'),
      keys.lbNight(3),
      keys.resultDiff(3, 'stargazer', 'hard'),
      keys.sharePost(3, 'stargazer'),
      keys.lbJwala(),
      keys.share(3, 'stargazer'),
      keys.postNight('t3_abc'),
      keys.nightPost(3),
    ];
    for (const key of all) expect(key.startsWith('tn:')).toBe(true);
  });

  it('separates nights and users', () => {
    expect(keys.result(3, 'ana')).not.toBe(keys.result(4, 'ana'));
    expect(keys.result(3, 'ana')).not.toBe(keys.result(3, 'bo'));
    expect(keys.share(3, 'ana')).not.toBe(keys.share(4, 'ana'));
    expect(keys.share(3, 'ana')).not.toBe(keys.share(3, 'bo'));
  });

  it('separates posts from nights, and from the night counters', () => {
    expect(keys.postNight('t3_abc')).not.toBe(keys.postNight('t3_xyz'));
    expect(keys.nightPost(3)).not.toBe(keys.nightPost(4));
    expect(keys.nightPost(3)).not.toBe(keys.nightStars(3));
    expect(keys.nightPost(3)).not.toBe(keys.nightPlayers(3));
  });
});

describe('nightScore', () => {
  type Diff = 'easy' | 'medium' | 'hard';
  const row = (difficulty: Diff, glitches: number, timeMs: number, whispers: number): number =>
    nightScore({ difficulty, glitches, timeMs, whispers });

  it('ranks Hard above Medium above Easy, whatever the numbers', () => {
    expect(row('hard', 999, 9_999_999, 99)).toBeLessThan(row('medium', 0, 0, 0));
    expect(row('medium', 999, 9_999_999, 99)).toBeLessThan(row('easy', 0, 0, 0));
  });

  it('then ranks fewer Glitches, then less time, then fewer Whispers', () => {
    expect(row('hard', 0, 9_999_999, 99)).toBeLessThan(row('hard', 1, 0, 0));
    expect(row('hard', 1, 10_000, 99)).toBeLessThan(row('hard', 1, 10_001, 0));
    expect(row('hard', 1, 10_000, 1)).toBeLessThan(row('hard', 1, 10_000, 2));
  });

  it('round-trips every field for display', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const parts of [
        { difficulty, glitches: 0, timeMs: 0, whispers: 0 },
        { difficulty, glitches: 3, timeMs: 45_000, whispers: 2 },
        { difficulty, glitches: 999, timeMs: 9_999_999, whispers: 99 },
      ]) {
        expect(nightScoreParts(nightScore(parts))).toEqual(parts);
      }
    }
  });

  it('stays integer-safe at its ceiling', () => {
    expect(row('easy', 999, 9_999_999, 99)).toBeLessThan(Number.MAX_SAFE_INTEGER);
  });
});
