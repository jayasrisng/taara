import { describe, expect, it } from 'vitest';
import { keys, whispersFromScore, whisperScore } from './keys';

describe('keys', () => {
  it('namespaces every key under tn:', () => {
    const all = [
      keys.nightStars(3),
      keys.nightPlayers(3),
      keys.result(3, 'stargazer'),
      keys.jwala('stargazer'),
      keys.sky('stargazer'),
      keys.lbFastest(3),
      keys.lbWhispers(3),
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

describe('whisperScore', () => {
  it('orders fewer Whispers ahead of more, whatever the time', () => {
    expect(whisperScore(0, 999_999)).toBeLessThan(whisperScore(1, 0));
    expect(whisperScore(1, 999_999)).toBeLessThan(whisperScore(2, 0));
  });

  it('breaks ties on Whispers by solve time', () => {
    expect(whisperScore(2, 10_000)).toBeLessThan(whisperScore(2, 20_000));
  });

  it('recovers the Whisper count for display', () => {
    for (const whispers of [0, 1, 2, 3]) {
      for (const timeMs of [0, 1, 45_000, 999_999]) {
        expect(whispersFromScore(whisperScore(whispers, timeMs))).toBe(whispers);
      }
    }
  });

  it('clamps the tiebreak so a slow solve cannot bleed into the next Whisper', () => {
    const verySlow = whisperScore(1, 5_000_000);
    expect(whispersFromScore(verySlow)).toBe(1);
    expect(verySlow).toBeLessThan(whisperScore(2, 0));
  });
});
