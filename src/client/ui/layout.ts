/**
 * Responsive layout plumbing.
 *
 * `game.ts` sizes the canvas in device pixels. Scenes want CSS pixels — a 44px
 * tap target has to be 44 *CSS* px on every device, and breakpoints like
 * "shorter than 560" only mean something in CSS px. `onLayout` reconciles the
 * two: it zooms the main camera by `DPR` and hands the scene a viewport it can
 * lay out against directly.
 */

import * as Phaser from 'phaser';
import type { Scene } from 'phaser';
import { DPR } from './display';

/** The drawable area, in CSS pixels. Scene coordinates live in this space. */
export interface Viewport {
  w: number;
  h: number;
}

export function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** The canvas size in CSS pixels. */
export function viewport(scene: Scene): Viewport {
  return { w: scene.scale.width / DPR, h: scene.scale.height / DPR };
}

/**
 * Point the main camera at a CSS-pixel world.
 *
 * The camera viewport spans the whole device-pixel canvas, zoomed by DPR, and
 * centred on the middle of the CSS-pixel viewport. World (0,0) then lands on
 * the canvas's top-left corner and world (w,h) on its bottom-right.
 */
function focusCamera(scene: Scene): Viewport {
  const { width, height } = scene.scale;
  const view = { w: width / DPR, h: height / DPR };

  scene.cameras.resize(width, height);
  scene.cameras.main.setZoom(DPR);
  scene.cameras.main.centerOn(view.w / 2, view.h / 2);

  return view;
}

/**
 * Lay the scene out now, and again on every canvas resize. Cleans up on
 * shutdown so a restarted scene doesn't stack duplicate listeners.
 */
export function onLayout(scene: Scene, layout: (view: Viewport) => void): void {
  const run = (): void => layout(focusCamera(scene));

  run();
  scene.scale.on('resize', run);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', run));
}
