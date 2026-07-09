/**
 * NightSky — a reusable, cozy animated backdrop.
 *
 * A vertical gradient, a hazy moon, a field of softly twinkling stars, and the
 * occasional slow shooting star. Shared by the menu and the play scene so the
 * whole game feels like one crafted night.
 *
 * Everything here is positioned from the CSS-pixel viewport handed to
 * `layout()`, so the sky fills any screen without a fixed design size.
 */

import { Scene, GameObjects } from 'phaser';
import { mulberry32 } from '../../shared/rng';
import { texScale } from './display';
import type { Viewport } from './layout';
import { prefs } from './prefs';
import { TEX, ensureTextures } from './textures';

const SKY_TOP = 0x05060f;
const SKY_BOTTOM = 0x161a3e;
const VIGNETTE_ALPHA = 0.38;

interface BgStar {
  nx: number; // normalized 0–1 across the screen
  ny: number;
  img: GameObjects.Image;
}

export class NightSky {
  private scene: Scene;
  private gfx: GameObjects.Graphics;
  private vignette: GameObjects.Graphics;
  private stars: BgStar[] = [];
  private moon: GameObjects.Image;
  private moonHalo: GameObjects.Image;
  private rng: () => number;
  private view: Viewport = { w: 0, h: 0 };

  constructor(scene: Scene, seed = 1) {
    this.scene = scene;
    ensureTextures(scene);
    this.rng = mulberry32(Math.floor(seed) * 2654435761 + 99);

    this.gfx = scene.add.graphics();

    this.moonHalo = scene.add
      .image(0, 0, TEX.moon)
      .setAlpha(0.22)
      .setScale(texScale(2.6))
      .setTint(0xaab4ff);
    this.moon = scene.add.image(0, 0, TEX.moon).setScale(texScale(0.85)).setTint(0xf7f4ff);

    const count = 90;
    for (let i = 0; i < count; i++) {
      const img = scene.add.image(0, 0, TEX.starSoft);
      const scale = 0.05 + this.rng() * 0.14;
      const baseAlpha = 0.35 + this.rng() * 0.5;
      img.setScale(texScale(scale)).setAlpha(baseAlpha);
      this.stars.push({ nx: this.rng(), ny: this.rng(), img });

      // Keep drawing from the rng even when still, so a reduced-motion sky has
      // its stars in the same places as everybody else's.
      const dim = baseAlpha * (0.3 + this.rng() * 0.3);
      const duration = 1600 + this.rng() * 3200;
      if (!prefs.animate) continue;

      scene.tweens.add({
        targets: img,
        alpha: dim,
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    this.vignette = scene.add.graphics();

    if (prefs.animate) this.scheduleShootingStar();
  }

  layout(view: Viewport): void {
    this.view = view;
    const { w, h } = view;

    this.gfx.clear();
    this.gfx.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1);
    this.gfx.fillRect(0, 0, w, h);

    const mx = w * 0.8;
    const my = h * 0.15;
    this.moon.setPosition(mx, my);
    this.moonHalo.setPosition(mx, my);

    for (const st of this.stars) st.img.setPosition(st.nx * w, st.ny * h);

    // Soft edge darkening for depth/focus. Each band fades to nothing where it
    // meets the sky — a constant alpha leaves a hard seam, which a high-DPI
    // canvas shows off beautifully.
    this.vignette.clear();
    const band = Math.max(w, h) * 0.18;
    const dark = 0x03040c;

    this.vignette.fillGradientStyle(dark, dark, dark, dark, VIGNETTE_ALPHA, VIGNETTE_ALPHA, 0, 0);
    this.vignette.fillRect(0, 0, w, band);
    this.vignette.fillGradientStyle(dark, dark, dark, dark, 0, 0, VIGNETTE_ALPHA, VIGNETTE_ALPHA);
    this.vignette.fillRect(0, h - band, w, band);
  }

  private scheduleShootingStar(): void {
    const delay = 4200 + this.rng() * 7000;
    this.scene.time.delayedCall(delay, () => {
      this.shoot();
      this.scheduleShootingStar();
    });
  }

  private shoot(): void {
    const { w, h } = this.view;
    if (w === 0) return;

    const startX = w * (0.1 + this.rng() * 0.55);
    const startY = h * (0.05 + this.rng() * 0.25);
    const streak = this.scene.add
      .image(startX, startY, TEX.spark)
      .setScale(texScale(0.9), texScale(0.14))
      .setAngle(28)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: streak,
      x: startX + w * 0.28,
      y: startY + h * 0.22,
      alpha: { from: 0.85, to: 0 },
      duration: 750,
      ease: 'Sine.in',
      onComplete: () => streak.destroy(),
    });
  }
}
