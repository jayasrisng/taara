/**
 * A press that only counts where it began.
 *
 * Phaser emits `GAMEOBJECT_POINTER_UP` for whatever the pointer happens to be
 * over when it is released, whether or not the press started there. Left alone
 * that means flicking the My Sky dome and letting go over the Back pill leaves
 * the scene, and drag-scrolling the Results panel past the Share button posts a
 * comment. So every button in TaaraNight arms on its own `pointerdown` and fires
 * only if the release lands on it while still armed. A release anywhere else —
 * including outside the canvas, which Phaser reports separately — disarms it.
 *
 * Sliding a thumb off a button and back on keeps the press alive, as it does on
 * every native button: only the release decides.
 *
 * This is also the one place that knows a fingertip is 44 CSS pixels wide. A
 * button may look smaller than that; it may never be smaller than that to touch.
 */

import * as Phaser from 'phaser';
import type { Scene, GameObjects } from 'phaser';

/** Nothing in the game is tappable in less than this, in CSS pixels. */
export const MIN_TAP = 44;

/**
 * A hit rectangle around an object's own bounds, grown to at least `MIN_TAP`.
 *
 * **Hit areas are measured from the top-left, always.** Phaser normalises the
 * pointer by the object's display origin before testing (`pointWithinHitArea`),
 * so a rectangle at `(0, 0, w, h)` is the object's own box whatever its origin —
 * that is exactly what `setInteractive()` builds by default. A `Container`
 * *looks* centre-origin, and is: its `displayOriginX` is `width / 2`, which
 * lands its local hit space at `(0, 0)` too. A rectangle written centred on
 * `(-w/2, -h/2)` therefore does not cover the object at all; it covers the box
 * half a width up and to the left of it.
 */
export function tapArea(width: number, height: number): Phaser.Geom.Rectangle {
  const padX = Math.max(0, MIN_TAP - width) / 2;
  const padY = Math.max(0, MIN_TAP - height) / 2;
  return new Phaser.Geom.Rectangle(-padX, -padY, width + padX * 2, height + padY * 2);
}

export interface PressableOptions {
  onClick: () => void;
  /** Paint the pressed state. Also fired when a thumb slides back on, still down. */
  onPress?: () => void;
  /** Desktop only: a pointer resting on the object with no button held. */
  onHover?: () => void;
  /** Back to neutral — on release, on leaving, and on a press that ends elsewhere. */
  onRest?: () => void;
  /** Asked at press and again at release, so a button can go deaf mid-press. */
  enabled?: () => boolean;
}

/**
 * Make `object` behave like a button. Cleans up after itself when the object is
 * destroyed, which every screen here does on resize, so there is nothing to hold.
 */
export function pressable(
  scene: Scene,
  object: GameObjects.GameObject,
  hitArea: Phaser.Geom.Rectangle,
  options: PressableOptions
): void {
  const { onClick, onPress, onHover, onRest, enabled = (): boolean => true } = options;
  let armed = false;

  object.setInteractive({
    hitArea,
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });

  object.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, (pointer: Phaser.Input.Pointer) => {
    if (!enabled()) return;
    // A pointer dragged over from elsewhere is passing through, not hovering.
    if (armed) onPress?.();
    else if (!pointer.isDown) onHover?.();
  });

  object.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => onRest?.());

  object.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
    if (!enabled()) return;
    armed = true;
    onPress?.();
  });

  object.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
    if (!armed) return;
    armed = false;
    onRest?.();
    if (enabled()) onClick();
  });

  const disarm = (): void => {
    if (!armed) return;
    armed = false;
    onRest?.();
  };

  // Scene-level, and always after the object's own handler above, so a release
  // that did land here has already fired and disarmed by the time this runs.
  scene.input.on(Phaser.Input.Events.POINTER_UP, disarm);
  scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, disarm);

  object.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.input.off(Phaser.Input.Events.POINTER_UP, disarm);
    scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, disarm);
  });
}
