/**
 * Display fidelity — the one place that knows about device pixels.
 *
 * The canvas is sized in *device* pixels while every scene keeps laying out in
 * CSS pixels; the main camera zooms by `DPR` to bridge the two (see `layout.ts`).
 * Vector work — Graphics, tinted quads — is re-rasterised by the GPU under that
 * zoom and comes out crisp for free. Two things do not, because they are
 * textures sampled at whatever size they were authored:
 *
 *   - `Text`, whose glyphs are rasterised to a canvas → use `crispText`
 *   - our generated glow textures → bake at DPR, then draw through `texScale`
 *
 * Phaser 4 has no game-level `resolution` config (it was dropped in v4's
 * `Config`), and `Text` forces `style.resolution` to 1 when unset, so every
 * Text object has to opt in individually.
 */

import type { GameObjects, Scene, Types } from 'phaser';

/**
 * Device pixels per CSS pixel, capped at 2.
 *
 * Past 2 the extra sharpness is invisible at phone viewing distance while the
 * full-screen gradient, vignette and star glows all overdraw with the square of
 * the ratio — a bad trade inside Reddit's mobile webview, where a 3× phone
 * would otherwise render 9× the fragments of a 1× desktop.
 */
export const DPR = typeof window === 'undefined' ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1));

/**
 * Convert a design-space scale into a texture scale.
 *
 * The glow textures are baked `DPR` times larger than their design size, so the
 * camera zoom magnifies pixels that actually exist. Passing every `setScale` on
 * those textures through here keeps their on-screen size unchanged.
 */
export function texScale(scale: number): number {
  return scale / DPR;
}

/** A `Text` whose glyphs are rasterised at DPR, so the camera zoom doesn't blur them. */
export function crispText(
  scene: Scene,
  x: number,
  y: number,
  content: string,
  style: Types.GameObjects.Text.TextStyle
): GameObjects.Text {
  return scene.add.text(x, y, content, { ...style, resolution: DPR });
}
