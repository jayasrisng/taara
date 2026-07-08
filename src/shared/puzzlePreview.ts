/**
 * Dev-only preview helpers for sanity-checking the nightly puzzle engine.
 *
 * Not shipped to players (it would spoil the constellation names). Used to
 * eyeball variety across consecutive nights during development/verification.
 */

import type { Difficulty } from './constellations';
import { generatePuzzle } from './puzzleEngine';
import { nightNumberAt } from './nightSeed';

/** A one-line summary of a single night's puzzle. */
export function describeNight(night: number, difficulty: Difficulty = 'hard'): string {
  const puzzle = generatePuzzle(night, difficulty);
  const decoys = puzzle.stars.filter((s) => s.isDecoy).length;
  return (
    `${puzzle.label.padEnd(16)} ` +
    `${puzzle.constellationId.padEnd(16)} ` +
    `real:${puzzle.realStarCount} ` +
    `glitch:${decoys} ` +
    `solution-edges:${puzzle.solution.length} ` +
    `[${difficulty}]`
  );
}

/** A multi-line table describing `count` consecutive nights from `startNight`. */
export function previewNights(startNight: number, count: number, difficulty: Difficulty = 'hard'): string {
  const lines: string[] = [];
  for (let n = startNight; n < startNight + count; n++) {
    lines.push(describeNight(n, difficulty));
  }
  return lines.join('\n');
}

/** Convenience: preview the 7 nights starting at whatever tonight's night is. */
export function previewUpcomingWeek(now: number | Date = Date.now(), difficulty: Difficulty = 'hard'): string {
  const tonight = Math.max(1, nightNumberAt(now));
  return previewNights(tonight, 7, difficulty);
}
