/**
 * Mood — the one word a share card uses to describe how a night went.
 *
 * It reads how much help the player needed (Whispers) and how often they
 * wandered into a Glitch, never how fast they were. Nothing here is a score and
 * nothing here shames: the bottom of the ladder is "Drowsy", which is exactly
 * what you want to be at bedtime.
 *
 * Spoiler-safe by construction — a mood can never name a constellation.
 */

export const MOODS = ['Luminous', 'Serene', 'Dreamy', 'Drowsy'] as const;

export type Mood = (typeof MOODS)[number];

/** Past this many Glitches the night is simply drowsy; counting further is noise. */
const GLITCH_CEILING = 6;

/** A Whisper is deliberate help, so it weighs more than an accidental Glitch. */
const WHISPER_WEIGHT = 2;

/** How far the player wandered from a clean solve. Always ≥ 0. */
export function wander(result: { whispers: number; glitches: number }): number {
  return result.whispers * WHISPER_WEIGHT + Math.min(result.glitches, GLITCH_CEILING);
}

export function moodFor(result: { whispers: number; glitches: number }): Mood {
  const distance = wander(result);
  if (distance === 0) return 'Luminous';
  if (distance <= 2) return 'Serene';
  if (distance <= 5) return 'Dreamy';
  return 'Drowsy';
}
