import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import type { Difficulty } from '../../shared/constellations';
import { nightNumberAt } from '../../shared/nightSeed';
import { NightSky } from '../ui/NightSky';

interface DiffDef {
  label: string;
  value: Difficulty;
  blurb: string;
  color: number;
  dots: number;
}

const DIFFICULTIES: DiffDef[] = [
  { label: 'Easy', value: 'easy', blurb: 'Outline shown · a gentle trace', color: 0xbfe6c9, dots: 1 },
  { label: 'Medium', value: 'medium', blurb: 'A few Glitches hide among the stars', color: 0xffe3a3, dots: 2 },
  { label: 'Hard', value: 'hard', blurb: 'Glitches, a soft timer & Whispers', color: 0xffb3b3, dots: 3 },
];

export class MainMenu extends Scene {
  private sky!: NightSky;
  private ui: GameObjects.GameObject[] = [];
  private entered = false;

  constructor() {
    super('MainMenu');
  }

  init(): void {
    this.ui = [];
    this.entered = false;
  }

  create(): void {
    const night = Math.max(1, nightNumberAt(Date.now()));
    this.sky = new NightSky(this, night);
    this.build(night);
    this.scale.on('resize', () => this.build(night));

    this.input.keyboard?.on('keydown-D', () => this.scene.start('ConstellationDebug'));
  }

  private build(night: number): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);
    this.sky.layout(width, height);

    // Clear any previously built UI (on resize) and rebuild for the new size.
    this.ui.forEach((o) => o.destroy());
    this.ui = [];

    // Title with a soft glow.
    const title = this.add
      .text(width / 2, height * 0.19, 'TaaraNight', {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: `${Math.min(52, width * 0.13)}px`,
        color: '#f7f4ff',
      })
      .setOrigin(0.5);
    title.setShadow(0, 0, '#8aa0ff', 18, true, true);
    this.ui.push(title);

    // "Tonight #N" pill.
    const pill = this.makePill(width / 2, height * 0.19 + 46, `🌙  Tonight · TaaraNight #${night}`, 0xffe3a3);
    this.ui.push(pill);

    const prompt = this.add
      .text(width / 2, height * 0.34, 'Choose your night', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#c9cff0',
        fontStyle: 'italic',
      })
      .setOrigin(0.5);
    this.ui.push(prompt);

    // Difficulty cards, sized in real pixels for big, reliable tap targets.
    const cardW = Math.min(width * 0.86, 460);
    const cardH = 82;
    const gap = 16;
    const totalH = DIFFICULTIES.length * cardH + (DIFFICULTIES.length - 1) * gap;
    const startY = Math.max(height * 0.45, height * 0.5 - totalH / 2);

    DIFFICULTIES.forEach((d, i) => {
      const y = startY + i * (cardH + gap) + cardH / 2;
      const card = this.makeCard(width / 2, y, cardW, cardH, d);
      this.ui.push(card);
      if (!this.entered) {
        card.setAlpha(0).setY(y + 24);
        this.tweens.add({
          targets: card,
          alpha: 1,
          y,
          duration: 460,
          delay: 120 + i * 90,
          ease: 'Back.out',
        });
      }
    });

    const footer = this.add
      .text(width / 2, height - 24, 'A new sky unlocks every night at 6 PM', {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#7883b0',
      })
      .setOrigin(0.5);
    this.ui.push(footer);

    this.entered = true;
  }

  private makePill(x: number, y: number, label: string, color: number): GameObjects.Container {
    const text = this.add
      .text(0, 0, label, { fontFamily: 'Arial', fontSize: '15px', color: '#e9ecff' })
      .setOrigin(0.5);
    const w = text.width + 34;
    const h = 32;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a2048, 0.85);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    bg.lineStyle(1, color, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    return this.add.container(x, y, [bg, text]);
  }

  private makeCard(x: number, y: number, w: number, h: number, d: DiffDef): GameObjects.Container {
    const radius = 18;

    const bg = this.add.graphics();
    const paint = (fill: number, fillAlpha: number, lineAlpha: number) => {
      bg.clear();
      bg.fillStyle(fill, fillAlpha);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
      bg.lineStyle(1.5, d.color, lineAlpha);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    };
    paint(0x1b2149, 0.9, 0.35);

    const label = this.add
      .text(-w / 2 + 26, -h / 2 + 18, d.label, {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: rgbHex(d.color),
      })
      .setOrigin(0, 0);

    const blurb = this.add
      .text(-w / 2 + 26, h / 2 - 18, d.blurb, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color: '#aeb6e0',
      })
      .setOrigin(0, 1);

    // Difficulty dots on the right.
    const dots: GameObjects.Arc[] = [];
    for (let i = 0; i < 3; i++) {
      const filled = i < d.dots;
      const dot = this.add.circle(w / 2 - 26 - i * 16, 0, 5, d.color, filled ? 1 : 0.22);
      if (!filled) dot.setStrokeStyle(1, d.color, 0.4);
      dots.push(dot);
    }

    const chevron = this.add
      .text(w / 2 - 76, 0, '›', { fontFamily: 'Arial', fontSize: '26px', color: '#aeb6e0' })
      .setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label, blurb, chevron, ...dots]);
    container.setSize(w, h);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains
    );

    const press = () => {
      paint(0x252c5c, 0.96, 0.7);
      this.tweens.add({ targets: container, scale: 0.97, duration: 90, ease: 'Sine.out' });
    };
    const release = () => {
      paint(0x1b2149, 0.9, 0.35);
      this.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Sine.out' });
    };

    container.on('pointerover', () => paint(0x232a58, 0.95, 0.6));
    container.on('pointerout', () => release());
    container.on('pointerdown', () => press());
    container.on('pointerup', () => {
      release();
      this.scene.start('Play', { difficulty: d.value });
    });

    return container;
  }
}

/** Convert a 0xRRGGBB number to a "#rrggbb" CSS string for Text colors. */
function rgbHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}
