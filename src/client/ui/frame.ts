/**
 * The frame every screen is drawn inside.
 *
 * Before this file the game had five side paddings, ten different fractions of
 * the viewport, and spacings composed by arithmetic — `space.xl + space.xs` is
 * 28, and 28 is not a step on a 4/8 scale. Screens that should have felt like
 * rooms in one house each had their own idea of where the wall was.
 *
 * So the page frame is three numbers, and every screen asks for them rather
 * than inventing them:
 *
 * - `gutter` — how far content stays from the left and right edges.
 * - `margin` — how far it stays from the top and bottom.
 * - `rhythm` — how far one block of a screen sits from the next.
 *
 * All three grow with the screen and stop at a token, so a phone gives up its
 * whitespace before it gives up its content, and a desktop never sprawls.
 *
 * This module knows nothing about Phaser, which is what lets it be tested and
 * what keeps it separate from `layout.ts` — that one is cameras and device
 * pixels, this one is where things go.
 */

import { space } from './theme';

/** The drawable area, in CSS pixels. Scene coordinates live in this space. */
export interface Viewport {
  w: number;
  h: number;
}

export function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** The margin between content and the side of the screen. */
export function gutter(view: Viewport): number {
  return clamp(space.md, view.w * 0.05, space.xxl);
}

/** The margin above the first thing on a screen, and below the last. */
export function margin(view: Viewport): number {
  return clamp(space.md, view.h * 0.035, space.xxl);
}

/**
 * The breathing space between two blocks of a screen's vertical flow. Always
 * smaller than the `margin` around them, so a screen reads as one column of
 * content rather than a stack of unrelated strips.
 */
export function rhythm(view: Viewport): number {
  return clamp(space.sm, view.h * 0.022, space.lg);
}

/** The width a screen actually has to lay type and controls out in. */
export function contentWidth(view: Viewport): number {
  return view.w - gutter(view) * 2;
}
