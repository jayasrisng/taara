/**
 * Nightly puzzle engine for TaaraNight — pure, deterministic logic (no UI).
 *
 * Given a night number (see nightSeed.ts) and a play difficulty, this module
 * produces the exact puzzle every player of that night sees: which
 * constellation, where the real stars sit, where the Glitch decoys sit, the
 * solution (which stars connect), and the difficulty parameters (hints, timer,
 * Whisper allowance). Same inputs → identical output, always.
 */

import type { Constellation, Difficulty } from './constellations';
import { CONSTELLATION_DATA } from './constellationData';
import { hashSeed, mulberry32, shuffleInPlace } from './rng';

/**
 * A constellation may not repeat within this many consecutive nights.
 * The dataset has more constellations than this, so the window is always
 * satisfiable.
 */
export const NO_REPEAT_WINDOW = 15;

/** Salt so the selection RNG is decorrelated from the star-field RNG. */
const SELECTION_SALT = 0x5741; // 'WA'

/** Stable numeric code per difficulty, used to seed the star field. */
const DIFFICULTY_CODE: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

/** Tunable knobs that define how a difficulty plays. */
export interface DifficultyParams {
  /** Show the finished constellation outline as a guide (Easy only). */
  showOutline: boolean;
  /** Tell the player how many real stars to connect. */
  showStarCountHint: boolean;
  /** Number of Glitch decoy stars mixed into the field. */
  decoyCount: number;
  /** Whether a soft timer runs (Hard only). */
  timed: boolean;
  /** Maximum Whisper hints the player may spend. */
  maxWhispers: number;
}

/**
 * Difficulty definitions. Each mode has to announce itself in the first five
 * seconds, so exactly one thing is added at every step and nothing is shared:
 *
 *  - Easy:   the whole outline, no Glitches, no timer, no Whispers — the
 *            outline *is* the help, so a hint button would be noise.
 *  - Medium: the outline goes away; a star count and a handful of Glitches
 *            arrive, and with them the three Whispers.
 *  - Hard:   the count goes away, the Glitches more than double, and the timer
 *            starts. Still three Whispers, never more.
 */
export const DIFFICULTY_PARAMS: Record<Difficulty, DifficultyParams> = {
  easy: { showOutline: true, showStarCountHint: true, decoyCount: 0, timed: false, maxWhispers: 0 },
  medium: { showOutline: false, showStarCountHint: true, decoyCount: 5, timed: false, maxWhispers: 3 },
  hard: { showOutline: false, showStarCountHint: false, decoyCount: 12, timed: true, maxWhispers: 3 },
};

/** A single star in the generated field. */
export interface PuzzleStar {
  /** Stable id = index into the puzzle's `stars` array. */
  id: number;
  /** X position, 0–1. */
  x: number;
  /** Y position, 0–1. */
  y: number;
  /** True for a Glitch decoy, false for a real constellation star. */
  isDecoy: boolean;
  /**
   * For real stars only: the index of this star within the source
   * constellation's `stars` array. Omitted entirely for decoys.
   */
  sourceIndex?: number;
}

/** An edge of the solution, referencing PuzzleStar ids. */
export interface PuzzleConnection {
  from: number;
  to: number;
}

/** The complete, deterministic puzzle for one night at one difficulty. */
export interface NightlyPuzzle {
  /** Night number (the "#N"). */
  night: number;
  /** Player-facing label, e.g. "TaaraNight #12". */
  label: string;
  difficulty: Difficulty;
  /** Source constellation id (spoiler — server/UI decides when to reveal). */
  constellationId: string;
  /** Source constellation name (spoiler — reveal only after completion). */
  name: string;
  /** English meaning of the name, e.g. "The Hunter" (spoiler, as `name`). */
  meaning: string;
  /** Bedtime story reward (spoiler — reveal only after completion). */
  story: string;
  params: DifficultyParams;
  /** Real stars + decoys, in a shuffled order. */
  stars: PuzzleStar[];
  /** The correct connections, as PuzzleStar id pairs. */
  solution: PuzzleConnection[];
  /** How many of `stars` are real (i.e. part of the constellation). */
  realStarCount: number;
}

const CONSTELLATIONS = CONSTELLATION_DATA.constellations;

/**
 * Deterministically choose the constellation index for a night such that no
 * constellation repeats within NO_REPEAT_WINDOW consecutive nights.
 *
 * We forward-simulate from night 1, keeping a small "recently used" window and
 * excluding those from each night's pick. Because the simulation is a pure
 * function of the night number, the result is fully reproducible. Cost is
 * O(night) per call, which is trivial at a nightly cadence.
 */
export function selectConstellationIndexForNight(night: number): number {
  const count = CONSTELLATIONS.length;
  // How many previous nights must differ. Clamp so the pool is never empty.
  const windowSize = Math.min(NO_REPEAT_WINDOW, count) - 1;

  const recent: number[] = [];
  let picked = 0;

  for (let n = 1; n <= night; n++) {
    const rng = mulberry32(hashSeed(n, SELECTION_SALT));
    const forbidden = new Set(recent);
    const pool: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!forbidden.has(i)) pool.push(i);
    }
    picked = pool[Math.floor(rng() * pool.length)] ?? 0;
    recent.push(picked);
    if (recent.length > windowSize) recent.shift();
  }

  return picked;
}

/** The constellation chosen for a given night. */
export function selectConstellationForNight(night: number): Constellation {
  const index = selectConstellationIndexForNight(night);
  const constellation = CONSTELLATIONS[index];
  if (!constellation) {
    throw new Error(`No constellation at index ${index}`);
  }
  return constellation;
}

/** A bare position in the 0–1 box. A Glitch is no star, so it has no catalogue. */
interface Point {
  x: number;
  y: number;
}

/**
 * Scatter `count` Glitch decoy stars across the 0–1 box, keeping them a minimum
 * distance from the real stars and from each other so they read as distinct
 * points. Deterministic given `rng`.
 */
function generateDecoys(realStars: readonly Point[], count: number, rng: () => number): Point[] {
  const decoys: Point[] = [];
  if (count <= 0) return decoys;

  const MIN_DISTANCE = 0.09;
  const MIN_DISTANCE_SQ = MIN_DISTANCE * MIN_DISTANCE;
  const MARGIN = 0.06; // keep decoys off the very edge
  const span = 1 - 2 * MARGIN;
  const maxAttempts = count * 300; // generous cap; prevents any infinite loop

  let attempts = 0;
  while (decoys.length < count && attempts < maxAttempts) {
    attempts++;
    const x = MARGIN + rng() * span;
    const y = MARGIN + rng() * span;

    let tooClose = false;
    for (const s of realStars) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy < MIN_DISTANCE_SQ) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      for (const d of decoys) {
        const dx = d.x - x;
        const dy = d.y - y;
        if (dx * dx + dy * dy < MIN_DISTANCE_SQ) {
          tooClose = true;
          break;
        }
      }
    }
    if (!tooClose) decoys.push({ x, y });
  }

  return decoys;
}

/**
 * Build the full puzzle for a night at a given difficulty.
 *
 * The constellation depends only on the night (so every difficulty of the same
 * night shares the same constellation and story). The star layout — decoys and
 * shuffle order — depends on (night, difficulty), so each difficulty gets a
 * distinct-but-reproducible field.
 */
export function generatePuzzle(night: number, difficulty: Difficulty): NightlyPuzzle {
  const constellation = selectConstellationForNight(night);
  const params = DIFFICULTY_PARAMS[difficulty];
  const rng = mulberry32(hashSeed(night, DIFFICULTY_CODE[difficulty]));

  const decoys = generateDecoys(constellation.stars, params.decoyCount, rng);

  // Assemble real + decoy records, then shuffle so decoys aren't always last.
  type StarRecord = { x: number; y: number; isDecoy: boolean; sourceIndex?: number };
  const records: StarRecord[] = [];
  constellation.stars.forEach((star, index) => {
    records.push({ x: star.x, y: star.y, isDecoy: false, sourceIndex: index });
  });
  for (const decoy of decoys) {
    records.push({ x: decoy.x, y: decoy.y, isDecoy: true });
  }
  shuffleInPlace(records, rng);

  // Ids are the post-shuffle positions.
  const stars: PuzzleStar[] = records.map((r, id) =>
    r.isDecoy
      ? { id, x: r.x, y: r.y, isDecoy: true }
      : { id, x: r.x, y: r.y, isDecoy: false, sourceIndex: r.sourceIndex! }
  );

  // Map source-constellation star index → shuffled PuzzleStar id.
  const idBySource = new Map<number, number>();
  for (const star of stars) {
    if (!star.isDecoy && star.sourceIndex !== undefined) {
      idBySource.set(star.sourceIndex, star.id);
    }
  }

  const solution: PuzzleConnection[] = constellation.connections.map((conn) => {
    const from = idBySource.get(conn.from);
    const to = idBySource.get(conn.to);
    if (from === undefined || to === undefined) {
      throw new Error(`Connection references a missing star in ${constellation.id}`);
    }
    return { from, to };
  });

  return {
    night,
    label: `TaaraNight #${night}`,
    difficulty,
    constellationId: constellation.id,
    name: constellation.name,
    meaning: constellation.meaning,
    story: constellation.story,
    params,
    stars,
    solution,
    realStarCount: constellation.stars.length,
  };
}
