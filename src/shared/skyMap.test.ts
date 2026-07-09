import { describe, it, expect } from 'vitest';
import { loadConstellations, getConstellationById } from './constellationLoader';
import {
  SKY_BOUNDS,
  SKY_EDGE_DEC,
  SKY_FIGURES,
  fieldStars,
  nearestStar,
  projectSky,
  radiusForDec,
  type MapPoint,
} from './skyMap';

function length(point: MapPoint): number {
  return Math.hypot(point.x, point.y);
}

function starOf(constellationId: string, name: string): MapPoint {
  const constellation = getConstellationById(constellationId);
  const star = constellation?.stars.find((s) => s.star === name);
  if (!star) throw new Error(`No star ${name} in ${constellationId}`);
  return projectSky(star);
}

describe('radiusForDec', () => {
  it('puts the celestial pole at the centre and the rim at radius 1', () => {
    expect(radiusForDec(90)).toBe(0);
    expect(radiusForDec(SKY_EDGE_DEC)).toBeCloseTo(1, 10);
  });

  it('places the celestial equator between them', () => {
    // tan(45°) / tan(67.5°)
    expect(radiusForDec(0)).toBeCloseTo(0.41421, 5);
  });

  it('grows monotonically as declination falls', () => {
    for (let dec = 89; dec > SKY_EDGE_DEC; dec -= 1) {
      expect(radiusForDec(dec - 1)).toBeGreaterThan(radiusForDec(dec));
    }
  });
});

describe('projectSky', () => {
  it('leaves Polaris all but on the pole', () => {
    expect(length(starOf('ursa-minor', 'Polaris'))).toBeLessThan(0.01);
  });

  it('rounds to four decimals, so every engine agrees', () => {
    const point = projectSky({ ra: 5.9195, dec: 7.407 });
    expect(point.x).toBe(Math.round(point.x * 1e4) / 1e4);
    expect(point.y).toBe(Math.round(point.y * 1e4) / 1e4);
  });

  it('is deterministic', () => {
    expect(projectSky({ ra: 13.7923, dec: 49.3133 })).toEqual(projectSky({ ra: 13.7923, dec: 49.3133 }));
  });

  // At 6h of right ascension the star sits straight below the pole, so the local
  // sky frame lines up with the screen: north is up, east is left. Get this
  // backwards and every constellation on the dome is mirrored.
  it('puts north up and east left where the two frames coincide', () => {
    const here = projectSky({ ra: 6, dec: 0 });
    const north = projectSky({ ra: 6, dec: 1 });
    const east = projectSky({ ra: 6.1, dec: 0 });

    expect(north.y).toBeLessThan(here.y);
    expect(Math.abs(north.x - here.x)).toBeLessThan(1e-3);
    expect(east.x).toBeLessThan(here.x);
  });

  it('stands Orion up the way the sky does — Betelgeuse above and left of Rigel', () => {
    const betelgeuse = starOf('orion', 'Betelgeuse');
    const rigel = starOf('orion', 'Rigel');

    expect(betelgeuse.x).toBeLessThan(rigel.x);
    expect(betelgeuse.y).toBeLessThan(rigel.y);
  });

  it('keeps every star in the dataset inside the dome', () => {
    for (const constellation of loadConstellations().constellations) {
      for (const star of constellation.stars) {
        expect(length(projectSky(star))).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('SKY_FIGURES', () => {
  it('lays down every constellation, star for star', () => {
    const dataset = loadConstellations().constellations;
    expect(SKY_FIGURES).toHaveLength(dataset.length);

    SKY_FIGURES.forEach((figure, index) => {
      const constellation = dataset[index]!;
      expect(figure.id).toBe(constellation.id);
      expect(figure.points).toHaveLength(constellation.stars.length);
      expect(figure.connections).toBe(constellation.connections);
    });
  });

  it('gives each figure a centre inside the dome and a radius that covers its stars', () => {
    for (const figure of SKY_FIGURES) {
      expect(length(figure.centre)).toBeLessThan(1);
      expect(figure.radius).toBeGreaterThan(0);

      for (const point of figure.points) {
        const spread = Math.hypot(point.x - figure.centre.x, point.y - figure.centre.y);
        expect(spread).toBeLessThanOrEqual(figure.radius + 1e-4);
      }
    }
  });

  // Orion is 82° of right ascension around the pole from Cassiopeia. If the dome
  // ever collapsed to a single tangent plane, these would land on top of each other.
  it('separates constellations that are far apart in the sky', () => {
    const orion = SKY_FIGURES.find((f) => f.id === 'orion')!;
    const cassiopeia = SKY_FIGURES.find((f) => f.id === 'cassiopeia')!;
    const apart = Math.hypot(orion.centre.x - cassiopeia.centre.x, orion.centre.y - cassiopeia.centre.y);

    expect(apart).toBeGreaterThan(orion.radius + cassiopeia.radius);
  });
});

describe('SKY_BOUNDS', () => {
  it('encloses every star and nothing more', () => {
    const points = SKY_FIGURES.flatMap((figure) => figure.points);

    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(SKY_BOUNDS.minX);
      expect(point.x).toBeLessThanOrEqual(SKY_BOUNDS.maxX);
      expect(point.y).toBeGreaterThanOrEqual(SKY_BOUNDS.minY);
      expect(point.y).toBeLessThanOrEqual(SKY_BOUNDS.maxY);
    }

    expect(Math.min(...points.map((p) => p.x))).toBe(SKY_BOUNDS.minX);
    expect(Math.max(...points.map((p) => p.y))).toBe(SKY_BOUNDS.maxY);
  });

  it('is a portrait rectangle well inside the disc, not the disc itself', () => {
    expect(SKY_BOUNDS.height).toBeGreaterThan(SKY_BOUNDS.width);
    expect(SKY_BOUNDS.width).toBeLessThan(2);
  });

  it('contains the celestial pole, which the dome turns around', () => {
    expect(SKY_BOUNDS.minX).toBeLessThan(0);
    expect(SKY_BOUNDS.maxX).toBeGreaterThan(0);
    expect(SKY_BOUNDS.minY).toBeLessThan(0);
    expect(SKY_BOUNDS.maxY).toBeGreaterThan(0);
  });
});

describe('nearestStar', () => {
  it('finds the star under a point, and names the constellation it belongs to', () => {
    const rigel = starOf('orion', 'Rigel');
    const hit = nearestStar(SKY_FIGURES, { x: rigel.x + 0.002, y: rigel.y - 0.001 }, 0.02);

    expect(hit?.figure.id).toBe('orion');
    expect(hit?.figure.points[hit.starIndex]).toEqual(rigel);
  });

  it('returns nothing when the nearest star is out of reach', () => {
    const rigel = starOf('orion', 'Rigel');
    expect(nearestStar(SKY_FIGURES, { x: rigel.x + 0.05, y: rigel.y }, 0.02)).toBeNull();
  });

  it('prefers the closer of two neighbouring stars', () => {
    const orion = SKY_FIGURES.find((f) => f.id === 'orion')!;
    const [first, second] = [orion.points[0]!, orion.points[1]!];
    const nudged = { x: first.x + (second.x - first.x) * 0.2, y: first.y + (second.y - first.y) * 0.2 };

    expect(nearestStar(SKY_FIGURES, nudged, 1)?.starIndex).toBe(0);
  });
});

describe('fieldStars', () => {
  it('is the same sky for everyone', () => {
    expect(fieldStars(60, 7)).toEqual(fieldStars(60, 7));
    expect(fieldStars(60, 8)).not.toEqual(fieldStars(60, 7));
  });

  it('draws the count it was asked for, inside the dome', () => {
    const stars = fieldStars(240, 7);
    expect(stars).toHaveLength(240);

    for (const star of stars) {
      expect(length(star)).toBeLessThanOrEqual(1);
      expect(star.magnitude).toBeGreaterThanOrEqual(0);
      expect(star.magnitude).toBeLessThanOrEqual(1);
    }
  });

  it('never crowds a real star', () => {
    const real = SKY_FIGURES.flatMap((figure) => figure.points);
    for (const star of fieldStars(240, 7)) {
      const nearest = Math.min(...real.map((r) => Math.hypot(star.x - r.x, star.y - r.y)));
      expect(nearest).toBeGreaterThanOrEqual(0.014);
    }
  });
});
