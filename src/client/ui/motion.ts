/**
 * The night, in motion.
 *
 * `theme.ts` says what the game looks like at rest; this says how it gets from
 * one rest to the next. Nothing in TaaraNight changes state instantly — a colour
 * that snaps, a card that vanishes, a screen that cuts to another screen all
 * read as a glitch in a game whose whole promise is calm.
 *
 * **Three eases, three meanings.** Things that *arrive* decelerate (`out`).
 * Things that *leave* accelerate away (`in`). Things that *breathe* — twinkles,
 * pulses, the dome gliding home — ease at both ends (`inOut`). There is no
 * overshoot anywhere: a bedtime sky does not bounce.
 *
 * **Stillness is a promise about movement, not about light.** A player who has
 * asked for stillness still sees the story fade in and the pill warm under their
 * thumb; what they never see is anything travel, scale, spin or shake. That
 * distinction lives here rather than in nineteen `if (prefs.animate)` branches:
 *
 * - `tween()` always plays. Under Stillness it silently drops its *movement*
 *   props and keeps its light. Use it for anything with an `alpha`.
 * - `motion()` returns `null` under Stillness and is not created at all. Use it
 *   for anything that is only movement — a shake, a pulse, a rising spark.
 * - `crossFade()` is light by definition and always plays.
 *
 * A tween whose only props are movement must use `motion()`: hand it to
 * `tween()` and Stillness will leave Phaser a tween with nothing to animate.
 */

import * as Phaser from 'phaser';
import { Cameras, Scene, Tweens } from 'phaser';
import { prefs } from './prefs';
import { color, mixColor } from './theme';

type Scale<K extends string> = Readonly<Record<K, number>>;

/**
 * Every duration in the game is one of these. The hand-caused ones sit in the
 * 150–250ms band where a transition still reads as a response; a reveal is
 * allowed to take its time, because taking its time is the point.
 */
export const duration: Scale<
  'tremor' | 'micro' | 'fast' | 'base' | 'slow' | 'reveal' | 'story' | 'breath'
> = {
  /** One leg of a shake. The only step below `micro`, and only shakes may use it. */
  tremor: 55,
  /** A control dipping under a thumb. */
  micro: 90,
  /** Hover and press paint, a star selected, a control coming back to rest. */
  fast: 160,
  /** The default: a thread drawn, a panel swapped, a screen leaving. */
  base: 220,
  /** A screen arriving, a ring blooming, a modal veil. */
  slow: 400,
  /** The sky dimming and the constellation swelling at completion. */
  reveal: 900,
  /** The myth rising. The slowest thing the player waits on. */
  story: 1200,
  /** Half of one ambient cycle — a twinkle, a pulse, the finished line-work. */
  breath: 1800,
};

export const ease = {
  /** Arriving. The default for everything the hand causes. */
  out: 'Cubic.out',
  /** Leaving. */
  in: 'Cubic.in',
  /** Breathing: loops, yoyos, and the dome gliding back to the whole sky. */
  inOut: 'Sine.inOut',
} as const;

/** The colour every screen fades through, matching `splash.css`'s backdrop. */
const NIGHT: readonly [number, number, number] = [
  (color.skyTop >> 16) & 0xff,
  (color.skyTop >> 8) & 0xff,
  color.skyTop & 0xff,
];

export type MotionConfig = Phaser.Types.Tweens.TweenBuilderConfig;

/** Props that carry an object somewhere. These are what Stillness refuses. */
const MOVEMENT = ['x', 'y', 'scale', 'scaleX', 'scaleY', 'angle', 'rotation'] as const;

function withoutMovement(config: MotionConfig): MotionConfig {
  const rest: MotionConfig = { ...config };
  for (const key of MOVEMENT) delete rest[key];
  return rest;
}

function defaults(config: MotionConfig): MotionConfig {
  return { ease: ease.out, duration: duration.base, ...config };
}

/**
 * A tween that always plays. Under Stillness it keeps its light and drops its
 * movement.
 *
 * Give a movement prop its starting value on the object itself rather than with
 * Phaser's `{ from, to }`. Two reasons: `from` is written to the target on the
 * tween's first *update*, so the object renders one frame at whatever it was
 * built with; and a dropped prop leaves the object exactly there, which is the
 * hook a still scene needs to place a ring at the size it would have bloomed to.
 */
export function tween(scene: Scene, config: MotionConfig): Tweens.Tween {
  const full = defaults(config);
  return scene.tweens.add(prefs.animate ? full : withoutMovement(full));
}

/** A tween that is nothing but movement. Under Stillness it never exists. */
export function motion(scene: Scene, config: MotionConfig): Tweens.Tween | null {
  if (!prefs.animate) return null;
  return scene.tweens.add(defaults(config));
}

/**
 * Walk a paint from one colour to another, calling `onStep` with the blended
 * colour and the raw 0–1 progress — so a caller repainting a border can carry
 * its alpha across on the same curve.
 *
 * Light, not movement: this plays under Stillness too.
 */
export function crossFade(
  scene: Scene,
  from: number,
  to: number,
  onStep: (blended: number, t: number) => void,
  ms: number = duration.fast
): Tweens.Tween {
  return scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: ms,
    ease: ease.out,
    onUpdate: (counter) => {
      const t = counter.getValue() ?? 1;
      onStep(mixColor(from, to, t), t);
    },
  });
}

/** Bring one camera up out of the night. */
export function enterCamera(camera: Cameras.Scene2D.Camera, ms: number = duration.slow): void {
  camera.fadeIn(ms, ...NIGHT);
}

/** Bring a scene up out of the night. Fades every camera, clipped panels included. */
export function enter(scene: Scene): void {
  for (const camera of scene.cameras.cameras) enterCamera(camera);
}

/**
 * Take the screen down into the night, then do `go` — normally starting the
 * next scene.
 *
 * Input is closed for the duration: a scene on its way out must not accept the
 * second tap of a double-tap, and `scene.start` re-enables input on the way in.
 * A second call while a fade-out is already running is ignored rather than
 * queued, so ESC and the Back pill cannot race each other.
 */
export function leave(scene: Scene, go: () => void): void {
  const main = scene.cameras.main;
  // `direction` is true while fading *out* — a fade-in must not block an exit.
  if (main.fadeEffect.isRunning && main.fadeEffect.direction) return;

  scene.input.enabled = false;
  for (const camera of scene.cameras.cameras) camera.fadeOut(duration.base, ...NIGHT);
  main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
}

/** The common case: fade out, then hand the game to another scene. */
export function leaveTo(scene: Scene, key: string, data?: object): void {
  leave(scene, () => scene.scene.start(key, data));
}
