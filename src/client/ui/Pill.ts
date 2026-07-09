/**
 * The rounded pill — TaaraNight's one button shape.
 *
 * The menu's night badge, the play HUD's Back/timer/Whisper controls, the
 * results tabs and the share button are all the same object wearing different
 * clothes, so they all live here. A pill sizes itself to its label and repaints
 * when that label changes.
 *
 * Every default is a CSS pixel: `HEIGHT` is a comfortable thumb target on the
 * phone screens most Reddit players are holding.
 */

import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import { crispText } from './display';

/** Big enough to tap without looking. */
const HEIGHT = 40;
const FONT_SIZE = 15;
const PADDING_X = 15;
const ACCENT = 0xffe3a3;

const FILL = 0x1a2048;
const FILL_HOVER = 0x232a58;
const FILL_PRESS = 0x252c5c;
const FILL_ACTIVE = 0x2b3268;

export interface PillStyle {
  height?: number;
  minWidth?: number;
  fontSize?: number;
  paddingX?: number;
  accent?: number;
}

export class Pill {
  readonly container: GameObjects.Container;

  private bg: GameObjects.Graphics;
  private label: GameObjects.Text;
  private style: Required<PillStyle>;

  private w = 0;
  private active = false;
  private enabled = true;

  constructor(scene: Scene, label: string, style: PillStyle = {}, onClick?: () => void) {
    this.style = {
      height: style.height ?? HEIGHT,
      minWidth: style.minWidth ?? 0,
      fontSize: style.fontSize ?? FONT_SIZE,
      paddingX: style.paddingX ?? PADDING_X,
      accent: style.accent ?? ACCENT,
    };

    this.bg = scene.add.graphics();
    this.label = crispText(scene, 0, 0, label, {
      fontFamily: 'Arial',
      fontSize: `${this.style.fontSize}px`,
      color: '#eef0ff',
    }).setOrigin(0.5);

    this.container = scene.add.container(0, 0, [this.bg, this.label]);
    this.resize();

    if (onClick) this.makeInteractive(onClick);
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.style.height;
  }

  setPosition(x: number, y: number): this {
    this.container.setPosition(x, y);
    return this;
  }

  setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  get visible(): boolean {
    return this.container.visible;
  }

  setLabel(text: string): this {
    if (this.label.text === text) return this;
    this.label.setText(text);
    this.resize();
    return this;
  }

  /** A tab that is currently showing, or a toggle that is on. */
  setActive(active: boolean): this {
    this.active = active;
    this.paint(this.active ? FILL_ACTIVE : FILL);
    return this;
  }

  /** A pill that has nothing left to do — dimmed, and deaf to taps. */
  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.container.setAlpha(enabled ? 1 : 0.45);
    return this;
  }

  destroy(): void {
    this.container.destroy();
  }

  private makeInteractive(onClick: () => void): void {
    const hit = (): Phaser.Geom.Rectangle =>
      new Phaser.Geom.Rectangle(-this.w / 2, -this.height / 2, this.w, this.height);

    const rest = (): void => this.paint(this.active ? FILL_ACTIVE : FILL);

    this.container.setInteractive(hit(), Phaser.Geom.Rectangle.Contains);
    this.container.on('pointerover', () => {
      if (this.enabled) this.paint(FILL_HOVER);
    });
    this.container.on('pointerout', rest);
    this.container.on('pointerdown', () => {
      if (this.enabled) this.paint(FILL_PRESS);
    });
    this.container.on('pointerup', () => {
      rest();
      if (this.enabled) onClick();
    });
  }

  /** Re-measure around the label and rebuild the hit area to match. */
  private resize(): void {
    this.w = Math.max(this.style.minWidth, this.label.width + this.style.paddingX * 2);
    this.container.setSize(this.w, this.height);
    this.paint(this.active ? FILL_ACTIVE : FILL);

    if (this.container.input) {
      this.container.input.hitArea = new Phaser.Geom.Rectangle(
        -this.w / 2,
        -this.height / 2,
        this.w,
        this.height
      );
    }
  }

  private paint(fill: number): void {
    const { height, accent } = this.style;
    const radius = height / 2;

    this.bg.clear();
    this.bg.fillStyle(fill, 0.9);
    this.bg.fillRoundedRect(-this.w / 2, -height / 2, this.w, height, radius);
    this.bg.lineStyle(1, accent, this.active ? 0.85 : 0.4);
    this.bg.strokeRoundedRect(-this.w / 2, -height / 2, this.w, height, radius);
  }
}

/** Convenience for the common case: a pill positioned right away. */
export function makePill(
  scene: Scene,
  x: number,
  y: number,
  label: string,
  style?: PillStyle,
  onClick?: () => void
): Pill {
  return new Pill(scene, label, style, onClick).setPosition(x, y);
}
