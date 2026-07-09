/**
 * Three sentences, once in a lifetime.
 *
 * A first-time player opens the sky and sees a field of stars with no obvious
 * verb. This card supplies the verb, promises that mistakes are free, and names
 * the reward — then gets out of the way and never returns.
 *
 * Every hint is true on every difficulty. Whispers and Glitches are deliberately
 * not mentioned: Easy has neither, and a hint that describes something the
 * player cannot see is worse than no hint at all.
 */

import { Scene, GameObjects } from 'phaser';
import { crispText } from './display';
import { clamp, type Viewport } from './layout';
import { duration, ease, tween } from './motion';
import { Pill } from './Pill';
import { prefs } from './prefs';
import { alpha, color, control, font, ink, radius, space, typeScale } from './theme';

/**
 * Emoji are drawn by the platform, and a glyph it does not have becomes a white
 * box on the card. These three are the ones the game already relies on
 * elsewhere, so they are the ones we know render.
 */
const HINTS = [
  { icon: '☝️', text: 'Drag from one star to another — or tap one, then the next.' },
  { icon: '✨', text: 'A wrong thread simply fades. Nothing is lost; take your time.' },
  { icon: '🌙', text: 'Complete the shape, and tonight’s story wakes.' },
];

const TITLE = 'Before you begin';
const BUTTON = 'Open the sky';

const DEPTH = 60;

/** True the first time anyone plays on this device. */
export function needsOnboarding(): boolean {
  return !prefs.onboarded;
}

/**
 * A modal card over the play scene. `onClose` runs once, after the card has
 * gone; the puzzle underneath is untouched and waiting.
 */
export class Onboarding {
  private scene: Scene;
  private layer: GameObjects.Container | null = null;
  private onClose: () => void;
  private closing = false;

  constructor(scene: Scene, onClose: () => void) {
    this.scene = scene;
    this.onClose = onClose;
  }

  /** Build (or rebuild, on resize) the card at this size. */
  layout(view: Viewport): void {
    if (this.closing) return;

    const first = !this.layer;
    this.layer?.destroy();

    const { w, h } = view;
    const sidePad = clamp(space.md, w * 0.05, space.xxl);
    const cardW = Math.min(w - sidePad * 2, 460);
    const padX = space.xl - space.xs;
    const wrap = cardW - padX * 2 - 34;

    // Purely a veil. Nothing here is interactive: a full-screen hit area — on the
    // scrim or on the container around it — wins the pointer against the button
    // sitting on top of it, and the card can then never be dismissed. The stars
    // underneath are held off by `Play`'s own guard while this card exists.
    const scrim = this.scene.add.graphics();
    scrim.fillStyle(color.void, alpha.scrim);
    scrim.fillRect(-w / 2, -h / 2, w, h);

    const title = crispText(this.scene, 0, 0, TITLE, {
      fontFamily: font.serif,
      fontSize: `${w < 380 ? typeScale.title : typeScale.heading}px`,
      color: ink.accent,
      fontStyle: 'italic',
    }).setOrigin(0.5, 0);

    const rows = HINTS.map(({ icon, text }) => {
      const bullet = crispText(this.scene, 0, 0, icon, { fontSize: `${typeScale.lead}px` }).setOrigin(0, 0);
      const body = crispText(this.scene, 0, 0, text, {
        fontFamily: font.sans,
        fontSize: `${w < 380 ? typeScale.caption : typeScale.body}px`,
        color: ink.body,
        lineSpacing: space.xs,
        wordWrap: { width: wrap },
      }).setOrigin(0, 0);
      return { bullet, body };
    });

    const button = new Pill(this.scene, BUTTON, { height: control.lg, minWidth: 200 }, () => this.close());

    /* Measure the flow, then place it around the card's centre. */

    const padTop = space.xl;
    const titleGap = space.xl - space.xs;
    const rowGap = space.lg;
    const buttonGap = space.xl;
    const padBottom = space.xl - space.xs;

    const rowHeights = rows.map(({ bullet, body }) => Math.max(bullet.height, body.height));
    const cardH =
      padTop +
      title.height +
      titleGap +
      rowHeights.reduce((sum, height) => sum + height + rowGap, 0) -
      rowGap +
      buttonGap +
      control.lg +
      padBottom;

    const top = -cardH / 2;
    let y = top + padTop;

    title.setY(y);
    y += title.height + titleGap;

    const textLeft = -cardW / 2 + padX + 30;
    rows.forEach(({ bullet, body }, i) => {
      bullet.setPosition(-cardW / 2 + padX, y + 1);
      body.setPosition(textLeft, y);
      y += rowHeights[i]! + rowGap;
    });
    y += buttonGap - rowGap;

    button.setPosition(0, y + control.lg / 2);

    const bg = this.scene.add.graphics();
    bg.fillStyle(color.card, alpha.card);
    bg.fillRoundedRect(-cardW / 2, top, cardW, cardH, radius.modal);
    bg.lineStyle(1.5, color.accentGlow, alpha.border);
    bg.strokeRoundedRect(-cardW / 2, top, cardW, cardH, radius.modal);

    const contents: GameObjects.GameObject[] = [scrim, bg, title, button.container];
    for (const { bullet, body } of rows) contents.push(bullet, body);

    const layer = this.scene.add.container(w / 2, h / 2, contents).setDepth(DEPTH);
    this.layer = layer;

    // A veil is light, not movement: it arrives softly under stillness too.
    if (first) {
      layer.setAlpha(0);
      tween(this.scene, { targets: layer, alpha: 1, duration: duration.slow });
    }
  }

  destroy(): void {
    this.layer?.destroy();
    this.layer = null;
  }

  private close(): void {
    if (this.closing) return;
    this.closing = true;
    prefs.set({ onboarded: true });

    const layer = this.layer;
    if (!layer) {
      this.onClose();
      return;
    }

    tween(this.scene, {
      targets: layer,
      alpha: 0,
      duration: duration.base,
      ease: ease.in,
      onComplete: () => {
        this.destroy();
        this.onClose();
      },
    });
  }
}
