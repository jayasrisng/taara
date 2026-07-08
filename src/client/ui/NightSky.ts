/**
 * NightSky — a reusable, cozy animated backdrop.
 *
 * A vertical gradient, a hazy moon, a field of softly twinkling stars, and the
 * occasional slow shooting star. Shared by the menu and the play scene so the
 * whole game feels like one crafted night.
 */

import { Scene, GameObjects } from 'phaser';
import { mulberry32 } from '../../shared/rng';
import { TEX, ensureTextures } from './textures';

const SKY_TOP = 0x05060f;
const SKY_BOTTOM = 0x161a3e;

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

  constructor(scene: Scene, seed = 1) {
    this.scene = scene;
    ensureTextures(scene);
    this.rng = mulberry32(Math.floor(seed) * 2654435761 + 99);

    this.gfx = scene.add.graphics();

    this.moonHalo = scene.add.image(0, 0, TEX.moon).setAlpha(0.22).setScale(2.6).setTint(0xaab4ff);
    this.moon = scene.add.image(0, 0, TEX.moon).setScale(0.85).setTint(0xf7f4ff);

    const count = 90;
    for (let i = 0; i < count; i++) {
      const img = scene.add.image(0, 0, TEX.starSoft);
      const scale = 0.05 + this.rng() * 0.14;
      const baseAlpha = 0.35 + this.rng() * 0.5;
      img.setScale(scale).setAlpha(baseAlpha);
      this.stars.push({ nx: this.rng(), ny: this.rng(), img });
      scene.tweens.add({
        targets: img,
        alpha: baseAlpha * (0.3 + this.rng() * 0.3),
        duration: 1600 + this.rng() * 3200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }

    this.vignette = scene.add.graphics();

    this.scheduleShootingStar();
  }

  layout(width: number, height: number): void {
    this.gfx.clear();
    this.gfx.fillGradientStyle(SKY_TOP, SKY_TOP, SKY_BOTTOM, SKY_BOTTOM, 1);
    this.gfx.fillRect(0, 0, width, height);

    const mx = width * 0.8;
    const my = height * 0.15;
    this.moon.setPosition(mx, my);
    this.moonHalo.setPosition(mx, my);

    for (const st of this.stars) st.img.setPosition(st.nx * width, st.ny * height);

    // Soft edge darkening for depth/focus.
    this.vignette.clear();
    const band = Math.max(width, height) * 0.18;
    this.vignette.fillStyle(0x03040c, 0.35);
    this.vignette.fillRect(0, 0, width, band);
    this.vignette.fillRect(0, height - band, width, band);
  }

  private scheduleShootingStar(): void {
    const delay = 4200 + this.rng() * 7000;
    this.scene.time.delayedCall(delay, () => {
      this.shoot();
      this.scheduleShootingStar();
    });
  }

  private shoot(): void {
    const { width, height } = this.scene.scale;
    const startX = width * (0.1 + this.rng() * 0.55);
    const startY = height * (0.05 + this.rng() * 0.25);
    const streak = this.scene.add
      .image(startX, startY, TEX.spark)
      .setScale(0.9, 0.14)
      .setAngle(28)
      .setAlpha(0);
    this.scene.tweens.add({
      targets: streak,
      x: startX + width * 0.28,
      y: startY + height * 0.22,
      alpha: { from: 0.85, to: 0 },
      duration: 750,
      ease: 'Sine.in',
      onComplete: () => streak.destroy(),
    });
  }
}
