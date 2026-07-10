/**
 * Icons, drawn as line-work in the night's own palette.
 *
 * The shapes live in `iconPaths.ts` as unit-box polylines; this file scales them,
 * strokes them and hands back a `Graphics` centred on its own origin, so an icon
 * drops into a container or a pill wherever a `Text` used to sit.
 *
 * Vector strokes are re-rasterised by the GPU under the camera's DPR zoom, so an
 * icon is crisp on every screen for free — which a `Text` glyph is not, and an
 * emoji never was.
 */

import type { GameObjects, Scene } from 'phaser';
import { iconPaths, type IconName } from './iconPaths';
import { color } from './theme';

export type { IconName } from './iconPaths';

/**
 * Stroke weight, in CSS px per px of icon size.
 *
 * One weight for every icon at every size: a 13px check and a 30px flame are
 * the same drawing seen from different distances, and a hairline that stays
 * hairline as the icon grows would read as a different, thinner family.
 */
const WEIGHT_RATIO = 1 / 11;
const MIN_WEIGHT = 1.15;

/** An icon beside a label, sized to the type it sits with. */
export function iconSizeFor(fontSize: number): number {
  return Math.round(fontSize * 1.2);
}

/** The two sizes an icon standing on its own is drawn at. */
export const iconSize: Readonly<Record<'hint' | 'hero', number>> = {
  /** The onboarding card's bullet column. */
  hint: 22,
  /** The Jwala flame over the Results panel. */
  hero: 30,
};

/**
 * Draw `name` at `size`, centred on the object's origin.
 *
 * Returns a plain `Graphics`, not a container: it can be positioned, tinted by
 * alpha, added to a `ScrollPanel`, and destroyed with its parent.
 */
export function drawIcon(scene: Scene, name: IconName, size: number, tint: number = color.accent): GameObjects.Graphics {
  const g = scene.add.graphics();
  paintIcon(g, name, size, tint);
  return g;
}

/** Repaint an existing `Graphics` as a different icon — a toggle flipping, say. */
export function paintIcon(g: GameObjects.Graphics, name: IconName, size: number, tint: number = color.accent): void {
  g.clear();
  g.lineStyle(Math.max(MIN_WEIGHT, size * WEIGHT_RATIO), tint, 1);

  for (const { points, closed } of iconPaths(name)) {
    const first = points[0];
    if (!first) continue;

    g.beginPath();
    g.moveTo(first.x * size, first.y * size);
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      g.lineTo(p.x * size, p.y * size);
    }
    if (closed) {
      g.closePath();
      // A lit body inside the line: the moon glows, the star burns. Two washes
      // — a warm base and a paler heart — read as depth without a gradient.
      g.fillStyle(tint, 0.4);
      g.fillPath();
      g.fillStyle(0xffffff, 0.14);
      g.fillPath();
    }
    g.strokePath();
  }

  // One small glint on the solid icons — the same point of light that lives on
  // every star in the game. Open line-work (a check, a thread) stays plain.
  if (iconPaths(name).some((path) => path.closed)) {
    g.fillStyle(0xffffff, 0.75);
    g.fillCircle(-size * 0.16, -size * 0.2, Math.max(0.9, size * 0.045));
  }
}
