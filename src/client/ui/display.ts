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

/** At or below this CSS-pixel short side we treat the screen as a phone. */
const PHONE_SHORT_SIDE = 540;

/**
 * Device pixels per CSS pixel, capped by how big the screen physically is.
 *
 * The cap exists to bound fragment cost: the full-screen gradient, vignette and
 * star glows all overdraw with the *square* of the ratio. But cost is
 * `cssArea × ratio²`, and a phone's css area is small — a 430×932 phone at 3×
 * paints 3.6M fragments, half of what a 2560×1440 desktop at 2× already paints
 * without complaint. So a flat cap of 2 buys nothing on phones and costs a lot:
 * it renders a DPR-3 screen at ⅔ resolution and lets the browser upscale, which
 * is exactly where the text and glow softness lives.
 *
 * Hence 3 on phone-sized screens, 2 on large ones (where a 3× panel really
 * would be a bad trade).
 */
export function displayScale(ratio: number, shortSide: number): number {
  const cap = shortSide <= PHONE_SHORT_SIDE ? 3 : 2;
  return Math.min(cap, Math.max(1, ratio || 1));
}

/**
 * Measured off `window`, not the game container: the playtest mobile toggle
 * shrinks the container to simulate a phone *layout*, and we must not answer
 * that by re-rasterising the whole game at 3×. Short side rather than width so
 * the answer survives rotation — `DPR` is read once at load, and the textures
 * baked against it can't be re-baked when the phone turns.
 */
export const DPR =
  typeof window === 'undefined'
    ? 1
    : displayScale(window.devicePixelRatio, Math.min(window.innerWidth, window.innerHeight));

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
