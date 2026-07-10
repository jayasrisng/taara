/**
 * The rounded pill — TaaraNight's one button shape.
 *
 * The menu's night badge, the play HUD's Back/timer/Whisper controls, the
 * results tabs and the share button are all the same object wearing different
 * clothes, so they all live here. A pill sizes itself to its label and repaints
 * when that label changes.
 *
 * Every default is a CSS pixel. A pill may be drawn shorter than a fingertip —
 * the menu's settings toggles are — but it is never *tapped* in less than one:
 * `pressable` grows the hit area to `MIN_TAP` behind the paint.
 */

import { Scene, GameObjects, Tweens } from 'phaser';
import { crispText } from './display';
import { drawIcon, iconSizeFor, paintIcon, type IconName } from './icons';
import { crossFade, duration, tween } from './motion';
import { pressable, tapArea } from './pressable';
import { alpha, color, control, font, hairline, ink, space, typeScale } from './theme';

export interface PillStyle {
  height?: number;
  minWidth?: number;
  fontSize?: number;
  paddingX?: number;
  accent?: number;
  /** A line icon before the label, sized to `fontSize`. Always the warm accent. */
  icon?: IconName;
}

/** Between an icon and the label it introduces. */
const ICON_GAP = space.sm;

export class Pill {
  readonly container: GameObjects.Container;

  private scene: Scene;
  private bg: GameObjects.Graphics;
  private label: GameObjects.Text;
  private icon: GameObjects.Graphics | null = null;
  private iconSize: number;
  private style: Omit<Required<PillStyle>, 'icon'>;

  private w = 0;
  private active = false;
  private enabled = true;

  /** The paint as it is on screen right now, mid-fade included. */
  private fill: number = color.surface;
  private strokeAlpha: number = alpha.stroke;
  /** Where that paint is heading, so a repeated hover does not restart the fade. */
  private fillTarget: number = color.surface;
  private paintTween: Tweens.Tween | null = null;

  constructor(scene: Scene, label: string, style: PillStyle = {}, onClick?: () => void) {
    this.scene = scene;
    this.style = {
      height: style.height ?? control.md,
      minWidth: style.minWidth ?? 0,
      fontSize: style.fontSize ?? typeScale.body,
      paddingX: style.paddingX ?? space.lg,
      accent: style.accent ?? color.accent,
    };
    this.iconSize = iconSizeFor(this.style.fontSize);

    this.bg = scene.add.graphics();
    this.label = crispText(scene, 0, 0, label, {
      fontFamily: font.sans,
      fontSize: `${this.style.fontSize}px`,
      color: ink.body,
    }).setOrigin(0.5);

    this.container = scene.add.container(0, 0, [this.bg, this.label]);
    if (style.icon) this.setIcon(style.icon);
    else this.resize();

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

  /**
   * Widen the pill's floor. Two pills side by side whose labels change — Sound
   * becoming Muted — must be given the same floor, or each toggle re-centres
   * the row and nudges its neighbour under the thumb that just tapped it.
   */
  setMinWidth(minWidth: number): this {
    if (this.style.minWidth === minWidth) return this;
    this.style.minWidth = minWidth;
    this.resize();
    return this;
  }

  /**
   * Show, change or drop the leading icon. `null` removes it — a Share pill that
   * has become "Signed out" is not sharing anything, and should not say it is.
   */
  setIcon(name: IconName | null): this {
    if (!name) {
      this.icon?.destroy();
      this.icon = null;
    } else if (this.icon) {
      paintIcon(this.icon, name, this.iconSize);
    } else {
      this.icon = drawIcon(this.scene, name, this.iconSize);
      // Above the background it sits on, below the label it introduces.
      this.container.addAt(this.icon, 1);
    }
    this.resize();
    return this;
  }

  /** A tab that is currently showing, or a toggle that is on. */
  setActive(active: boolean): this {
    this.active = active;
    this.settle();
    return this;
  }

  /** A pill that has nothing left to do — dimmed, deaf to taps, and no hand cursor. */
  setEnabled(enabled: boolean): this {
    if (this.enabled !== enabled) {
      this.enabled = enabled;
      tween(this.scene, {
        targets: this.container,
        alpha: enabled ? 1 : alpha.disabled,
        duration: duration.fast,
      });
    }
    // A pill disabled mid-press (Share, the moment it is tapped) keeps its
    // pressed paint otherwise, and never gets a release to clear it.
    this.settle();
    if (this.container.input) this.container.input.cursor = enabled ? 'pointer' : '';
    return this;
  }

  destroy(): void {
    // The fade repaints `bg` every frame, so it must not outlive it.
    this.paintTween?.remove();
    this.paintTween = null;
    this.scene.tweens.killTweensOf(this.container);
    this.container.destroy();
  }

  private makeInteractive(onClick: () => void): void {
    pressable(this.scene, this.container, tapArea(this.w, this.height), {
      onClick,
      onHover: () => this.fadeTo(color.surfaceHover),
      onPress: () => this.fadeTo(color.surfacePress),
      onRest: () => this.settle(),
      enabled: () => this.enabled,
    });
  }

  /** Back to whatever this pill looks like when nobody is touching it. */
  private settle(): void {
    this.fadeTo(this.restFill());
  }

  private restFill(): number {
    return this.active ? color.surfaceActive : color.surface;
  }

  private restStroke(): number {
    return this.active ? alpha.strokeStrong : alpha.stroke;
  }

  /**
   * Warm the pill towards a new fill. The border alpha rides the same curve, so
   * a tab turning active brightens its edge as it brightens its face.
   */
  private fadeTo(fill: number): void {
    const strokeTo = this.restStroke();
    if (this.fillTarget === fill && this.strokeAlpha === strokeTo) return;

    this.paintTween?.remove();
    this.fillTarget = fill;

    const fromFill = this.fill;
    const fromStroke = this.strokeAlpha;
    this.paintTween = crossFade(
      this.scene,
      fromFill,
      fill,
      (blended, t) => {
        this.fill = blended;
        this.strokeAlpha = fromStroke + (strokeTo - fromStroke) * t;
        this.paint();
      },
      duration.fast
    );
  }

  /**
   * Re-measure around the contents and rebuild the hit area to match.
   *
   * Icon and label are laid out as one block and that block is centred, so an
   * icon shifts the label right rather than hanging off the pill's left edge.
   * An icon with no label (the Play HUD's sound button) takes no gap.
   */
  private resize(): void {
    const iconW = this.icon ? this.iconSize : 0;
    const gap = this.icon && this.label.text ? ICON_GAP : 0;
    const contentW = iconW + gap + this.label.width;

    this.w = Math.max(this.style.minWidth, contentW + this.style.paddingX * 2);
    this.icon?.setPosition(-contentW / 2 + iconW / 2, 0);
    this.label.setX(contentW / 2 - this.label.width / 2);

    this.container.setSize(this.w, this.height);
    this.paint();

    if (this.container.input) this.container.input.hitArea = tapArea(this.w, this.height);
  }

  private paint(): void {
    const { height, accent } = this.style;
    const radius = height / 2;

    this.bg.clear();
    this.bg.fillStyle(this.fill, alpha.fill);
    this.bg.fillRoundedRect(-this.w / 2, -height / 2, this.w, height, radius);
    this.bg.lineStyle(hairline, accent, this.strokeAlpha);
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
