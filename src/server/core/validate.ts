/**
 * Request validation for the completion endpoint.
 *
 * Kept free of any Devvit import so it can be unit tested directly. This is a
 * cozy game, not a competitive one, so this is sanity-checking rather than
 * anti-cheat: reject nonsense, clamp the merely implausible.
 */

import type { CompleteRequest } from '../../shared/api';
import type { Difficulty } from '../../shared/constellations';
import { DIFFICULTY_PARAMS } from '../../shared/puzzleEngine';

export type Validated<T> = { ok: true; value: T } | { ok: false; message: string };

/** A solve longer than 24h is a tab left open overnight, not a play. */
export const MAX_TIME_MS = 24 * 60 * 60 * 1000;
/** Nobody meaningfully mis-taps a Glitch more than this. */
export const MAX_GLITCHES = 999;

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function clamp(value: number, max: number): number {
  return Math.min(value, max);
}

/**
 * Parse an untrusted request body into a CompleteRequest.
 *
 * Rejects: unknown difficulty, negative/non-integer counts, more Whispers than
 * the difficulty allows, a night override below 1.
 * Clamps: absurd solve times and Glitch counts.
 */
export function validateCompleteRequest(body: unknown): Validated<CompleteRequest> {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Request body must be an object' };
  }

  const raw: Record<string, unknown> = { ...body };

  if (!isDifficulty(raw.difficulty)) {
    return { ok: false, message: 'difficulty must be easy, medium or hard' };
  }
  const difficulty = raw.difficulty;

  if (!isCount(raw.timeMs)) {
    return { ok: false, message: 'timeMs must be a non-negative integer' };
  }
  if (!isCount(raw.whispers)) {
    return { ok: false, message: 'whispers must be a non-negative integer' };
  }
  if (!isCount(raw.glitches)) {
    return { ok: false, message: 'glitches must be a non-negative integer' };
  }

  const maxWhispers = DIFFICULTY_PARAMS[difficulty].maxWhispers;
  if (raw.whispers > maxWhispers) {
    return { ok: false, message: `whispers must be at most ${maxWhispers} on ${difficulty}` };
  }

  const value: CompleteRequest = {
    difficulty,
    timeMs: clamp(raw.timeMs, MAX_TIME_MS),
    whispers: raw.whispers,
    glitches: clamp(raw.glitches, MAX_GLITCHES),
  };

  if (raw.night !== undefined) {
    if (!isCount(raw.night) || raw.night < 1) {
      return { ok: false, message: 'night must be an integer >= 1' };
    }
    value.night = raw.night;
  }

  return { ok: true, value };
}
