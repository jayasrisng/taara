/**
 * The whole sky on one page.
 *
 * `projection.ts` projects one constellation into its own 0–1 puzzle box. This
 * module does the opposite job: it lays *every* constellation down together, at
 * its true place on the celestial sphere, so My Sky can be one continuous dome
 * rather than a grid of thumbnails.
 *
 * **Stereographic, about the north celestial pole.** Our stars run from Polaris
 * (+89°) to Shaula (−43°), so no tangent plane reaches them all — a gnomonic
 * projection diverges before it gets halfway. Stereographic is conformal: it
 * preserves angles, so a constellation still *looks* like itself anywhere on the
 * dome. That is the whole point of the real coordinates we went and fetched.
 * Southern shapes are drawn larger than northern ones, which is exactly what a
 * paper planisphere does and what the sky honestly requires.
 *
 * **North is inward, not up.** On a polar map "north" points at the pole, so a
 * constellation is rotated by its own right ascension — Orion stands upright
 * near the bottom, Cassiopeia lies on its side at the right. That is not a bug;
 * it is what the turning sky looks like from underneath.
 *
 * **East is left**, as in the puzzle: at 6h of right ascension, increasing
 * declination moves a star up the screen and increasing right ascension moves it
 * left. Everything here is a pure function of the catalogue coordinates.
 *
 * Map space is the unit disc: the pole sits at the origin, and the rim — the
 * −45° parallel, just south of the deepest star we draw — sits at radius 1.
 */

import type { Connection, Constellation } from './constellations';
import { loadConstellations } from './constellationLoader';
import type { SkyCoord } from './projection';
import { hashSeed, mulberry32 } from './rng';

const DEG = Math.PI / 180;
const HOURS_TO_DEG = 15;

/** The southernmost declination the dome reaches. Shaula, at −43°, is the deepest star we draw. */
export const SKY_EDGE_DEC = -45;

/** The rim's stereographic radius, which normalises the dome to a unit disc. */
const EDGE_RADIUS = Math.tan(((90 - SKY_EDGE_DEC) / 2) * DEG);

/** A point on the dome. The pole is (0, 0); the rim is at radius 1. y grows south on screen. */
export interface MapPoint {
  x: number;
  y: number;
}

/** As in `projection.ts`: four decimals is far finer than a star's glow and immune to engine drift. */
function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** How far from the pole a parallel of declination falls, in map units. */
export function radiusForDec(dec: number): number {
  return Math.tan(((90 - dec) / 2) * DEG) / EDGE_RADIUS;
}

/** Place one catalogue coordinate on the dome. */
export function projectSky({ ra, dec }: SkyCoord): MapPoint {
  const radius = radiusForDec(dec);
  const angle = ra * HOURS_TO_DEG * DEG;
  return { x: round4(radius * Math.cos(angle)), y: round4(radius * Math.sin(angle)) };
}

/** One constellation, laid down on the dome among all the others. */
export interface SkyFigure {
  id: string;
  name: string;
  /** Its stars, in the order `connections` indexes them. */
  points: MapPoint[];
  connections: readonly Connection[];
  /** The mean of its stars — where a label hangs and where the view centres. */
  centre: MapPoint;
  /** Distance from `centre` to its furthest star, in map units. */
  radius: number;
}

function toFigure(constellation: Constellation): SkyFigure {
  const points = constellation.stars.map(projectSky);

  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  const centre = { x: round4(sumX / points.length), y: round4(sumY / points.length) };
  const radius = Math.max(...points.map((p) => Math.hypot(p.x - centre.x, p.y - centre.y)));

  return {
    id: constellation.id,
    name: constellation.name,
    points,
    connections: constellation.connections,
    centre,
    radius: round4(radius),
  };
}

/** Every constellation in the dataset, in dataset order, placed on the dome. */
export const SKY_FIGURES: readonly SkyFigure[] = loadConstellations().constellations.map(toFigure);

/** A rectangle of map space. */
export interface MapBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centre: MapPoint;
  width: number;
  height: number;
}

function boundsOf(points: readonly MapPoint[]): MapBounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    centre: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * The rectangle the constellations actually occupy — not the whole disc.
 *
 * Our nineteen skies are a northern set: Polaris sits at the pole and Scorpius'
 * tail is the only thing that reaches far south, so the outer half of the disc
 * holds nothing but dust. A "whole sky" view frames *this*, and the empty rim
 * stays where it belongs, out past the edge of the screen.
 */
export const SKY_BOUNDS: MapBounds = boundsOf(SKY_FIGURES.flatMap((figure) => figure.points));

/** The star nearest a point, across every figure — the dome's hit test. */
export interface FigureHit {
  figure: SkyFigure;
  starIndex: number;
  distance: number;
}

/**
 * Nearest star wins, so two constellations that brush against each other still
 * resolve cleanly. `maxDistance` is in map units; the caller converts from the
 * tap tolerance it wants on screen.
 */
export function nearestStar(
  figures: readonly SkyFigure[],
  point: MapPoint,
  maxDistance: number
): FigureHit | null {
  let hit: FigureHit | null = null;

  for (const figure of figures) {
    figure.points.forEach((star, starIndex) => {
      const distance = Math.hypot(star.x - point.x, star.y - point.y);
      if (distance > maxDistance) return;
      if (!hit || distance < hit.distance) hit = { figure, starIndex, distance };
    });
  }

  return hit;
}

/** A star that belongs to no constellation — the dust that makes the dome a sky. */
export interface FieldStar extends MapPoint {
  /** 0 (barely there) to 1 (bright). */
  magnitude: number;
}

/** Kept this far from every real star, so a field star is never mistaken for one. */
const FIELD_MIN_GAP = 0.014;
/** Rejection sampling can never hang: past this many tries the last draw stands. */
const FIELD_ATTEMPTS = 16;

/**
 * Scatter anonymous stars across the dome, evenly over the sphere rather than
 * evenly over the disc — otherwise the rim, which is stretched, would look bare.
 * Seeded, so everyone's sky has the same dust in the same places.
 */
export function fieldStars(count: number, seed: number): FieldStar[] {
  const rng = mulberry32(hashSeed(count, seed));
  const real = SKY_FIGURES.flatMap((figure) => figure.points);

  // Uniform in sin(dec) is uniform on the sphere.
  const sinMin = Math.sin(SKY_EDGE_DEC * DEG);
  const stars: FieldStar[] = [];

  for (let i = 0; i < count; i++) {
    let point: MapPoint = { x: 0, y: 0 };

    for (let attempt = 0; attempt < FIELD_ATTEMPTS; attempt++) {
      const dec = Math.asin(sinMin + rng() * (1 - sinMin)) / DEG;
      point = projectSky({ ra: rng() * 24, dec });
      if (real.every((star) => Math.hypot(point.x - star.x, point.y - star.y) >= FIELD_MIN_GAP)) break;
    }

    // Squared, so most of the dust is faint and a few grains carry the eye.
    stars.push({ ...point, magnitude: round4(rng() ** 2) });
  }

  return stars;
}
