/**
 * Jwala — the streak flame.
 *
 * A Jwala counts *consecutive night numbers* a player has completed, never
 * calendar days. The night number already encodes the 01:00 UTC boundary (see
 * nightSeed.ts), so streak math never has to think about time zones, DST, or
 * what "yesterday" means to someone playing at 00:59 UTC.
 *
 * Pure functions only — the server persists the state, this module decides it.
 */

export type JwalaState = {
  /** Nights completed back-to-back, ending at `lastNight`. */
  current: number;
  /** Best `current` this player has ever reached. */
  longest: number;
  /** The highest night number this player has completed. 0 = never played. */
  lastNight: number;
};

/** A player who has never completed a night. */
export const EMPTY_JWALA: JwalaState = { current: 0, longest: 0, lastNight: 0 };

/**
 * Fold a newly completed night into a player's Jwala.
 *
 * - The night straight after `lastNight` feeds the flame (`current + 1`).
 * - Any other newer night means nights were missed, so the flame restarts at 1.
 * - A night at or before `lastNight` — an already-counted night, or an old
 *   archive post played later — leaves the flame untouched. Replaying the past
 *   can never rekindle or break a streak.
 *
 * Idempotent for a given night: calling twice with the same night is a no-op
 * the second time, which is what makes the repeat-play guard safe.
 */
export function advanceJwala(prev: JwalaState, night: number): JwalaState {
  if (night <= prev.lastNight) return prev;

  const current = night === prev.lastNight + 1 ? prev.current + 1 : 1;

  return {
    current,
    longest: Math.max(prev.longest, current),
    lastNight: night,
  };
}
