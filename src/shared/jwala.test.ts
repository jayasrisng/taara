import { describe, expect, it } from 'vitest';
import { advanceJwala, EMPTY_JWALA, type JwalaState } from './jwala';

const state = (current: number, longest: number, lastNight: number): JwalaState => ({
  current,
  longest,
  lastNight,
});

describe('advanceJwala', () => {
  it('starts a fresh flame on a first-ever completion', () => {
    expect(advanceJwala(EMPTY_JWALA, 1)).toEqual(state(1, 1, 1));
  });

  it('starts at 1 even when the first completion is a late night', () => {
    expect(advanceJwala(EMPTY_JWALA, 12)).toEqual(state(1, 1, 12));
  });

  it('feeds the flame on the very next night', () => {
    expect(advanceJwala(state(1, 1, 5), 6)).toEqual(state(2, 2, 6));
  });

  it('grows across consecutive nights', () => {
    let jwala = EMPTY_JWALA;
    for (let night = 1; night <= 5; night++) {
      jwala = advanceJwala(jwala, night);
    }
    expect(jwala).toEqual(state(5, 5, 5));
  });

  it('restarts at 1 when a night is missed, keeping the longest', () => {
    expect(advanceJwala(state(7, 7, 10), 12)).toEqual(state(1, 7, 12));
  });

  it('does not lower the longest once a new streak overtakes it', () => {
    const rebuilt = advanceJwala(state(3, 7, 20), 21);
    expect(rebuilt).toEqual(state(4, 7, 21));
    expect(advanceJwala(state(7, 7, 21), 22)).toEqual(state(8, 8, 22));
  });

  it('is a no-op for a night already counted (the repeat-play guard)', () => {
    const before = state(4, 9, 30);
    expect(advanceJwala(before, 30)).toBe(before);
  });

  it('ignores an older archive night, neither breaking nor extending the flame', () => {
    const before = state(4, 9, 30);
    expect(advanceJwala(before, 3)).toBe(before);
    expect(advanceJwala(before, 29)).toBe(before);
  });

  it('never mutates the state it is given', () => {
    const before = state(2, 2, 8);
    advanceJwala(before, 9);
    expect(before).toEqual(state(2, 2, 8));
  });

  it('treats the night boundary, not the calendar, as the unit of a streak', () => {
    // Two plays 25 hours apart that land in nights 4 and 5 continue a streak;
    // two plays 2 hours apart spanning the 01:00 UTC boundary do too. Both are
    // simply "night n then night n+1" here — no clock arithmetic involved.
    expect(advanceJwala(state(1, 1, 4), 5)).toEqual(state(2, 2, 5));
  });
});
