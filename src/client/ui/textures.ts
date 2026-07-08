/**
 * Runtime-generated soft "glow" textures.
 *
 * Flat vector circles read as cheap; a radial soft-edged dot reads as a
 * luminous star. We bake a few reusable textures once per game so both the
 * menu and the play scene share the same premium look (and so we ship no image
 * assets — Devvit-Rules safe).
 */

import type { Scene } from 'phaser';

export const TEX = {
  /** Cool white star glow, used for real/decoy stars and background stars. */
  starSoft: 'taara-star-soft',
  /** Warm sparkle, used for shooting stars and completion sparkles. */
  spark: 'taara-spark',
  /** Big soft orb, used for the moon (and its halo). */
  moon: 'taara-moon',
} as const;

/**
 * Draw a soft radial dot by stacking translucent circles from the rim inward,
 * so the centre builds to near-opaque and the edge fades to nothing.
 */
function ensureRadial(scene: Scene, key: string, size: number, color: number, falloff: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = size / 2;
  for (let radius = c; radius >= 1; radius -= 1) {
    const edgeDistance = radius / c; // 1 at the rim, →0 at the centre
    const alpha = Math.pow(1 - edgeDistance, falloff);
    g.fillStyle(color, alpha * 0.16);
    g.fillCircle(c, c, radius);
  }
  g.generateTexture(key, size, size);
  g.destroy();
}

/** Create the shared glow textures if they don't already exist. */
export function ensureTextures(scene: Scene): void {
  ensureRadial(scene, TEX.starSoft, 64, 0xffffff, 2.2);
  ensureRadial(scene, TEX.spark, 40, 0xffe9c0, 1.6);
  ensureRadial(scene, TEX.moon, 160, 0xf4f1ff, 2.6);
}
