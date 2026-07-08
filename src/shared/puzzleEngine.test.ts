/**
 * Tests for the nightly puzzle engine: determinism, difficulty differences,
 * the no-repeat window, and star-field integrity.
 */

import { describe, it, expect } from 'vitest';
import type { Difficulty } from './constellations';
import { getConstellationById } from './constellationLoader';
import {
  NO_REPEAT_WINDOW,
  DIFFICULTY_PARAMS,
  selectConstellationForNight,
  selectConstellationIndexForNight,
  generatePuzzle,
} from './puzzleEngine';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
const SAMPLE_NIGHTS = [1, 2, 3, 7, 8, 15, 16, 42, 100];

describe('selection: determinism', () => {
  it('returns the same constellation for the same night every time', () => {
    for (const night of SAMPLE_NIGHTS) {
      const a = selectConstellationForNight(night);
      const b = selectConstellationForNight(night);
      expect(a.id).toBe(b.id);
    }
  });

  it('picks a real constellation from the dataset', () => {
    for (const night of SAMPLE_NIGHTS) {
      const c = selectConstellationForNight(night);
      expect(getConstellationById(c.id)).toBeDefined();
    }
  });
});

describe('selection: no repeats within the window', () => {
  it(`never repeats a constellation within ${NO_REPEAT_WINDOW} consecutive nights`, () => {
    const total = 500;
    const ids: string[] = [];
    for (let night = 1; night <= total; night++) {
      ids.push(selectConstellationForNight(night).id);
    }
    for (let start = 0; start + NO_REPEAT_WINDOW <= ids.length; start++) {
      const windowIds = ids.slice(start, start + NO_REPEAT_WINDOW);
      const unique = new Set(windowIds);
      expect(unique.size).toBe(NO_REPEAT_WINDOW);
    }
  });

  it('still shows variety and reaches most constellations over time', () => {
    const seen = new Set<number>();
    for (let night = 1; night <= 200; night++) {
      seen.add(selectConstellationIndexForNight(night));
    }
    // Over 200 nights we should have used a healthy spread of the dataset.
    expect(seen.size).toBeGreaterThanOrEqual(10);
  });
});

describe('difficulty parameters', () => {
  it('easy has an outline and no decoys', () => {
    expect(DIFFICULTY_PARAMS.easy.showOutline).toBe(true);
    expect(DIFFICULTY_PARAMS.easy.decoyCount).toBe(0);
    expect(DIFFICULTY_PARAMS.easy.timed).toBe(false);
  });

  it('medium adds a few decoys and a star-count hint but no timer', () => {
    expect(DIFFICULTY_PARAMS.medium.decoyCount).toBeGreaterThan(0);
    expect(DIFFICULTY_PARAMS.medium.showStarCountHint).toBe(true);
    expect(DIFFICULTY_PARAMS.medium.timed).toBe(false);
  });

  it('hard has the most decoys, a timer, and no outline', () => {
    expect(DIFFICULTY_PARAMS.hard.decoyCount).toBeGreaterThan(DIFFICULTY_PARAMS.medium.decoyCount);
    expect(DIFFICULTY_PARAMS.hard.timed).toBe(true);
    expect(DIFFICULTY_PARAMS.hard.showOutline).toBe(false);
  });

  it('caps Whispers at 3 on hard', () => {
    expect(DIFFICULTY_PARAMS.hard.maxWhispers).toBe(3);
  });
});

describe('generatePuzzle: determinism', () => {
  it('produces byte-for-byte identical puzzles for the same (night, difficulty)', () => {
    for (const night of SAMPLE_NIGHTS) {
      for (const difficulty of DIFFICULTIES) {
        const a = generatePuzzle(night, difficulty);
        const b = generatePuzzle(night, difficulty);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
    }
  });
});

describe('generatePuzzle: constellation shared across difficulties', () => {
  it('uses the same constellation for every difficulty of a given night', () => {
    for (const night of SAMPLE_NIGHTS) {
      const easy = generatePuzzle(night, 'easy');
      const medium = generatePuzzle(night, 'medium');
      const hard = generatePuzzle(night, 'hard');
      expect(easy.constellationId).toBe(medium.constellationId);
      expect(medium.constellationId).toBe(hard.constellationId);
      expect(easy.story).toBe(hard.story);
    }
  });
});

describe('generatePuzzle: star field integrity', () => {
  it('has the right decoy count and total star count per difficulty', () => {
    for (const night of SAMPLE_NIGHTS) {
      for (const difficulty of DIFFICULTIES) {
        const puzzle = generatePuzzle(night, difficulty);
        const decoys = puzzle.stars.filter((s) => s.isDecoy);
        const real = puzzle.stars.filter((s) => !s.isDecoy);
        expect(decoys.length).toBe(DIFFICULTY_PARAMS[difficulty].decoyCount);
        expect(real.length).toBe(puzzle.realStarCount);
        expect(puzzle.stars.length).toBe(real.length + decoys.length);
      }
    }
  });

  it('gives easy zero decoys (only real stars)', () => {
    for (const night of SAMPLE_NIGHTS) {
      const puzzle = generatePuzzle(night, 'easy');
      expect(puzzle.stars.every((s) => !s.isDecoy)).toBe(true);
    }
  });

  it('keeps every star inside the 0–1 box', () => {
    for (const night of SAMPLE_NIGHTS) {
      for (const difficulty of DIFFICULTIES) {
        for (const star of generatePuzzle(night, difficulty).stars) {
          expect(star.x).toBeGreaterThanOrEqual(0);
          expect(star.x).toBeLessThanOrEqual(1);
          expect(star.y).toBeGreaterThanOrEqual(0);
          expect(star.y).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('assigns contiguous ids equal to array position', () => {
    const puzzle = generatePuzzle(8, 'hard');
    puzzle.stars.forEach((star, index) => expect(star.id).toBe(index));
  });

  it('keeps decoys clear of real stars (minimum spacing)', () => {
    const MIN = 0.09;
    const puzzle = generatePuzzle(8, 'hard');
    const real = puzzle.stars.filter((s) => !s.isDecoy);
    const decoys = puzzle.stars.filter((s) => s.isDecoy);
    for (const d of decoys) {
      for (const r of real) {
        const dist = Math.hypot(d.x - r.x, d.y - r.y);
        expect(dist).toBeGreaterThanOrEqual(MIN - 1e-9);
      }
    }
  });

  it('only real stars carry a sourceIndex; decoys carry none', () => {
    const puzzle = generatePuzzle(8, 'hard');
    for (const star of puzzle.stars) {
      if (star.isDecoy) {
        expect(star.sourceIndex).toBeUndefined();
      } else {
        expect(typeof star.sourceIndex).toBe('number');
      }
    }
  });
});

describe('generatePuzzle: solution correctness', () => {
  it('has one solution edge per source connection and references only real stars', () => {
    for (const night of SAMPLE_NIGHTS) {
      for (const difficulty of DIFFICULTIES) {
        const puzzle = generatePuzzle(night, difficulty);
        const source = getConstellationById(puzzle.constellationId)!;
        expect(puzzle.solution.length).toBe(source.connections.length);

        const byId = new Map(puzzle.stars.map((s) => [s.id, s]));
        for (const edge of puzzle.solution) {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          expect(from).toBeDefined();
          expect(to).toBeDefined();
          expect(from!.isDecoy).toBe(false);
          expect(to!.isDecoy).toBe(false);
        }
      }
    }
  });

  it('preserves the constellation shape (solution edges match source edges by position)', () => {
    const puzzle = generatePuzzle(8, 'hard');
    const source = getConstellationById(puzzle.constellationId)!;

    // Rebuild source-index → star position via sourceIndex, then confirm each
    // solution edge connects the same two physical points as the source.
    const posBySource = new Map<number, { x: number; y: number }>();
    for (const star of puzzle.stars) {
      if (!star.isDecoy && star.sourceIndex !== undefined) {
        posBySource.set(star.sourceIndex, { x: star.x, y: star.y });
      }
    }
    const byId = new Map(puzzle.stars.map((s) => [s.id, s]));

    source.connections.forEach((conn, i) => {
      const edge = puzzle.solution[i]!;
      const expectedFrom = posBySource.get(conn.from)!;
      const expectedTo = posBySource.get(conn.to)!;
      const actualFrom = byId.get(edge.from)!;
      const actualTo = byId.get(edge.to)!;
      expect(actualFrom.x).toBe(expectedFrom.x);
      expect(actualFrom.y).toBe(expectedFrom.y);
      expect(actualTo.x).toBe(expectedTo.x);
      expect(actualTo.y).toBe(expectedTo.y);
    });
  });
});

describe('generatePuzzle: labelling', () => {
  it('labels the puzzle "TaaraNight #N"', () => {
    expect(generatePuzzle(12, 'easy').label).toBe('TaaraNight #12');
    expect(generatePuzzle(12, 'easy').night).toBe(12);
  });
});
