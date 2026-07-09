/**
 * A clipped, drag-scrollable column.
 *
 * My Sky and the leaderboards can both outgrow a phone screen, and a Reddit
 * webview gives us no page scroll to fall back on.
 *
 * **Why a camera and not a mask.** Phaser 4's `setMask` is a Canvas-renderer
 * feature: under WebGL it warns and does nothing (see
 * `gameobjects/components/Mask.js`). The renderer here is `AUTO`, so it is
 * WebGL. A second Camera with its own viewport clips natively, costs no render
 * target, and gives us scrolling for free — the camera moves, the content
 * stands still.
 *
 * The panel camera renders *only* this panel's content, and the main camera
 * renders everything but. Objects are sorted into one or the other by their
 * `cameraFilter` bit: everything added to the scene is hidden from the panel
 * camera on sight, and `add()` un-hides whatever it takes in (children
 * included, since a Container consults each child's filter).
 *
 * Content is read-only by design — nothing inside a panel is interactive, so a
 * drag can never be mistaken for a tap on a button. Keep buttons outside.
 *
 * Coordinates inside the panel start at its top-left corner.
 */

import * as Phaser from 'phaser';
import { Scene, GameObjects, Cameras } from 'phaser';
import { DPR } from './display';

/** How far one wheel notch moves the content, in CSS pixels. */
const WHEEL_STEP = 0.6;

/** The thin bar that appears only when there is somewhere to scroll to. */
const BAR_WIDTH = 3;
const BAR_COLOR = 0x8b95c9;

export class ScrollPanel {
  private scene: Scene;
  private camera: Cameras.Scene2D.Camera;
  private content: GameObjects.Container;
  private bar: GameObjects.Graphics;

  private bounds = { x: 0, y: 0, w: 0, h: 0 };
  private contentHeight = 0;
  private scroll = 0;

  private dragging = false;
  private lastPointerY = 0;

  constructor(scene: Scene) {
    this.scene = scene;

    this.camera = scene.cameras.add(0, 0, 1, 1);
    this.content = scene.add.container(0, 0);
    this.bar = scene.add.graphics();

    // The two cameras divide the scene between them.
    scene.cameras.main.ignore(this.content);
    for (const object of scene.children.list) {
      if (object !== this.content) this.camera.ignore(object);
    }
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);
  }

  /**
   * Take objects into the panel. Their positions are relative to its top-left
   * corner, and they become visible to the panel camera alone.
   */
  add(...objects: GameObjects.GameObject[]): void {
    for (const object of objects) {
      this.content.add(object);
      this.reveal(object);
    }
  }

  /**
   * Position and size the window the content is seen through, in CSS pixels.
   *
   * The viewport is device pixels — it is a slice of the canvas — while the
   * camera zooms by DPR so the content inside keeps laying out in CSS pixels,
   * exactly as the rest of the scene does.
   */
  setBounds(x: number, y: number, w: number, h: number): void {
    this.bounds = { x, y, w, h };
    this.content.setPosition(x, y);
    this.camera.setViewport(x * DPR, y * DPR, w * DPR, h * DPR);
    this.camera.setZoom(DPR);
    this.applyScroll();
  }

  /**
   * Fade the panel in alongside the scene. The panel has its own camera, so the
   * main camera's fade does not cover it — without this the content pops in at
   * full brightness while the rest of the screen is still arriving.
   */
  fadeIn(duration: number, red: number, green: number, blue: number): void {
    this.camera.fadeIn(duration, red, green, blue);
  }

  /** Tell the panel how tall its content turned out, so it knows its limits. */
  setContentHeight(height: number): void {
    this.contentHeight = height;
    this.applyScroll();
  }

  /** Empty the panel and return it to the top. */
  clear(): void {
    this.content.removeAll(true);
    this.contentHeight = 0;
    this.scroll = 0;
    this.applyScroll();
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.onWheel, this);

    this.scene.cameras.remove(this.camera);
    this.content.destroy();
    this.bar.destroy();
  }

  /* ---------------------------------------------------------------- *
   *  Camera bookkeeping
   * ---------------------------------------------------------------- */

  /** Anything new in the scene belongs to the main camera until `add` claims it. */
  private onAdded(object: GameObjects.GameObject): void {
    if (object !== this.content) this.camera.ignore(object);
  }

  /** Undo that, for this object and everything nested inside it. */
  private reveal(object: GameObjects.GameObject): void {
    object.cameraFilter &= ~this.camera.id;

    const children = (object as GameObjects.Container).list;
    if (Array.isArray(children)) {
      for (const child of children) this.reveal(child);
    }
  }

  /* ---------------------------------------------------------------- *
   *  Scrolling
   * ---------------------------------------------------------------- */

  private get maxScroll(): number {
    return Math.max(0, this.contentHeight - this.bounds.h);
  }

  /**
   * Content too short to scroll is centred rather than pinned to the top —
   * otherwise a modest Tonight panel drifts to the ceiling of a tall screen.
   */
  private get restOffset(): number {
    if (this.maxScroll > 0) return 0;
    return Math.max(0, (this.bounds.h - this.contentHeight) / 2);
  }

  private contains(x: number, y: number): boolean {
    const { x: bx, y: by, w, h } = this.bounds;
    return x >= bx && x <= bx + w && y >= by && y <= by + h;
  }

  private applyScroll(): void {
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll);

    const { x, y, w, h } = this.bounds;
    this.camera.centerOn(x + w / 2, y + this.scroll - this.restOffset + h / 2);
    this.drawBar();
  }

  private drawBar(): void {
    this.bar.clear();
    if (this.maxScroll <= 0) return;

    const { x, y, w, h } = this.bounds;
    const trackH = h - 8;
    const thumbH = Math.max(28, (h / this.contentHeight) * trackH);
    const thumbY = y + 4 + (this.scroll / this.maxScroll) * (trackH - thumbH);
    const thumbX = x + w - BAR_WIDTH;

    this.bar.fillStyle(BAR_COLOR, 0.12);
    this.bar.fillRoundedRect(thumbX, y + 4, BAR_WIDTH, trackH, BAR_WIDTH / 2);
    this.bar.fillStyle(BAR_COLOR, 0.5);
    this.bar.fillRoundedRect(thumbX, thumbY, BAR_WIDTH, thumbH, BAR_WIDTH / 2);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.maxScroll <= 0 || !this.contains(pointer.worldX, pointer.worldY)) return;
    this.dragging = true;
    this.lastPointerY = pointer.worldY;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || !pointer.isDown) return;
    this.scroll += this.lastPointerY - pointer.worldY;
    this.lastPointerY = pointer.worldY;
    this.applyScroll();
  }

  private onUp(): void {
    this.dragging = false;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (this.maxScroll <= 0 || !this.contains(pointer.worldX, pointer.worldY)) return;
    this.scroll += dy * WHEEL_STEP;
    this.applyScroll();
  }
}
