import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import { showToast } from '@devvit/web/client';
import type { Difficulty } from '../../shared/constellations';
import { nightNumberAt } from '../../shared/nightSeed';
import { NightSky } from '../ui/NightSky';
import { crispText } from '../ui/display';
import { clamp, onLayout, type Viewport } from '../ui/layout';
import { makePill } from '../ui/Pill';
import { fetchInit, postComplete } from '../api';

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

/** Never let a card shrink below a comfortable thumb. */
const MIN_CARD_H = 56;
const MAX_CARD_H = 96;

/** Below this height the "Choose your night" line is the first thing to go. */
const DENSE_H = 540;
/** Below this width the cards drop their chevron and tighten their type. */
const NARROW_W = 380;

export class MainMenu extends Scene {
  private sky!: NightSky;
  private ui: GameObjects.GameObject[] = [];
  private entered = false;
  private view: Viewport = { w: 0, h: 0 };

  /** Tonight, computed locally so the menu paints without waiting on the API. */
  private night = 1;
  /** A quiet line of tonight's shared numbers, once the server has answered. */
  private communityLine: string | null = null;

  constructor() {
    super('MainMenu');
  }

  init(): void {
    this.ui = [];
    this.entered = false;
    this.communityLine = null;
  }

  create(): void {
    this.night = Math.max(1, nightNumberAt(Date.now()));
    this.sky = new NightSky(this, this.night);

    onLayout(this, (view) => this.build(view));

    void this.syncWithServer();

    this.input.keyboard?.on('keydown-D', () => this.scene.start('ConstellationDebug'));
    this.input.keyboard?.on('keydown-J', () => void this.rehearseLastNight());
  }

  /** Rebuild at the current size, after content (not the viewport) changed. */
  private relayout(): void {
    if (this.view.w > 0) this.build(this.view);
  }

  /**
   * The server owns the night number and the community's numbers. The menu
   * shows its own guess first, then quietly reconciles — if the API is asleep,
   * the sky is still open.
   */
  private async syncWithServer(): Promise<void> {
    const init = await fetchInit();
    if (!init || !this.scene.isActive()) return;

    this.night = init.night;
    this.communityLine = describeTonight(init.community.starsTonight, init.jwala.current);
    this.relayout();
  }

  /**
   * Dev-only: mark last night as completed so a Jwala of 2 can be verified
   * without waiting a day. The server refuses this outside the playtest
   * subreddit, so pressing J on a real post does nothing but show a message.
   */
  private async rehearseLastNight(): Promise<void> {
    const night = this.night;
    if (night <= 1) {
      showToast('No night before TaaraNight #1');
      return;
    }

    const response = await postComplete({
      difficulty: 'easy',
      timeMs: 1000,
      whispers: 0,
      glitches: 0,
      night: night - 1,
    });

    showToast(
      response?.recorded
        ? `Night #${night - 1} rehearsed · Jwala ${response.jwala.current}`
        : 'Night override refused (dev subreddit only)'
    );
  }

  /**
   * A vertical flow: the title block grows down from the top, the community and
   * footer lines grow up from the bottom, and the difficulty cards take the
   * space that is actually left over. Nothing is placed at a fixed offset, so
   * nothing can collide on a short screen.
   */
  private build(view: Viewport): void {
    this.view = view;
    const { w, h } = view;
    this.sky.layout(view);

    // Clear any previously built UI (on resize) and rebuild for the new size.
    this.ui.forEach((o) => o.destroy());
    this.ui = [];

    const sidePad = clamp(14, w * 0.05, 32);
    const dense = h < DENSE_H;
    const narrow = w < NARROW_W;
    const textWidth = w - sidePad * 2;

    /* ---- top block, flowing down ---- */

    let top = clamp(14, h * 0.05, 44);

    const title = crispText(this, w / 2, top, 'TaaraNight', {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: `${clamp(28, Math.min(w * 0.12, h * 0.08), 54)}px`,
      color: '#f7f4ff',
    }).setOrigin(0.5, 0);
    title.setShadow(0, 0, '#8aa0ff', 18, true, true);
    this.ui.push(title);
    top += title.height + clamp(6, h * 0.012, 12);

    const pillH = 32;
    const pill = makePill(this, w / 2, top + pillH / 2, `🌙  Tonight · TaaraNight #${this.night}`, {
      height: pillH,
      paddingX: 17,
    });
    this.ui.push(pill.container);
    top += pillH;

    if (!dense) {
      const prompt = crispText(this, w / 2, top + clamp(10, h * 0.022, 20), 'Choose your night', {
        fontFamily: 'Georgia, serif',
        fontSize: '18px',
        color: '#c9cff0',
        fontStyle: 'italic',
      }).setOrigin(0.5, 0);
      this.ui.push(prompt);
      top = prompt.y + prompt.height;
    }

    /* ---- bottom block, flowing up ---- */

    let bottom = h - clamp(12, h * 0.03, 28);

    const footer = crispText(this, w / 2, bottom, 'A new sky unlocks every night at 6 PM', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#7883b0',
      align: 'center',
      wordWrap: { width: textWidth },
    }).setOrigin(0.5, 1);
    this.ui.push(footer);
    bottom -= footer.height + 8;

    if (this.communityLine) {
      const community = crispText(this, w / 2, bottom, this.communityLine, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#a7b0da',
        align: 'center',
        wordWrap: { width: textWidth },
      }).setOrigin(0.5, 1);
      this.ui.push(community);
      bottom -= community.height + 6;
    }

    /* ---- the cards take what is left ---- */

    const edge = clamp(10, h * 0.025, 28);
    const midTop = top + edge;
    const midH = Math.max(MIN_CARD_H, bottom - edge - midTop);
    const cardW = Math.min(textWidth, 460);

    let gap = clamp(8, h * 0.018, 18);
    let cards = this.buildCards(cardW, midH, gap, narrow, false);

    // Two-line blurbs can push the stack past the space we reserved on a very
    // short screen. Rather than let it slide under the footer, the cards give
    // up their blurb — the label and the dots still say everything essential.
    if (stackHeight(cards, gap) > midH) {
      cards.forEach((c) => c.destroy());
      gap = 8;
      cards = this.buildCards(cardW, midH, gap, narrow, true);
    }

    let y = midTop + Math.max(0, (midH - stackHeight(cards, gap)) / 2);
    cards.forEach((card, i) => {
      const centreY = y + card.height / 2;
      card.setPosition(w / 2, centreY);
      y += card.height + gap;
      this.ui.push(card);

      if (!this.entered) {
        card.setAlpha(0).setY(centreY + 24);
        this.tweens.add({
          targets: card,
          alpha: 1,
          y: centreY,
          duration: 460,
          delay: 120 + i * 90,
          ease: 'Back.out',
        });
      }
    });

    this.entered = true;
  }

  private buildCards(
    cardW: number,
    midH: number,
    gap: number,
    narrow: boolean,
    hideBlurb: boolean
  ): GameObjects.Container[] {
    const targetH = clamp(MIN_CARD_H, (midH - gap * 2) / DIFFICULTIES.length, MAX_CARD_H);
    return DIFFICULTIES.map((d) => this.makeCard(cardW, targetH, d, narrow, hideBlurb));
  }

  /**
   * A difficulty card. Height is `max(targetH, whatever the text needs)`, so a
   * blurb that wraps to two lines grows the card instead of spilling out of it.
   */
  private makeCard(
    w: number,
    targetH: number,
    d: DiffDef,
    narrow: boolean,
    hideBlurb: boolean
  ): GameObjects.Container {
    const radius = 18;
    const padX = narrow ? 18 : 26;
    const padY = 14;
    const showChevron = !narrow;

    // Right-hand column: three dots, and a chevron when there is room for one.
    const dotStep = 15;
    const dotRight = w / 2 - padX;
    const dotsLeft = dotRight - dotStep * 2 - 5;
    const chevronX = dotsLeft - 18;
    const textRight = showChevron ? chevronX - 14 : dotsLeft - 12;
    const textLeft = -w / 2 + padX;
    const textW = Math.max(60, textRight - textLeft);

    const label = crispText(this, textLeft, 0, d.label, {
      fontFamily: 'Georgia, serif',
      fontSize: `${narrow ? 20 : 24}px`,
      color: rgbHex(d.color),
    }).setOrigin(0, 0);

    const blurb = hideBlurb
      ? null
      : crispText(this, textLeft, 0, d.blurb, {
          fontFamily: 'Arial',
          fontSize: `${narrow ? 12 : 13}px`,
          color: '#aeb6e0',
          wordWrap: { width: textW },
        }).setOrigin(0, 0);

    const contentH = label.height + (blurb ? 4 + blurb.height : 0);
    const h = Math.max(targetH, contentH + padY * 2);

    label.setY(-contentH / 2);
    blurb?.setY(-contentH / 2 + label.height + 4);

    const bg = this.add.graphics();
    const paint = (fill: number, fillAlpha: number, lineAlpha: number): void => {
      bg.clear();
      bg.fillStyle(fill, fillAlpha);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
      bg.lineStyle(1.5, d.color, lineAlpha);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
    };
    paint(0x1b2149, 0.9, 0.35);

    const dots: GameObjects.Arc[] = [];
    for (let i = 0; i < 3; i++) {
      const filled = i < d.dots;
      const dot = this.add.circle(dotRight - i * dotStep, 0, 5, d.color, filled ? 1 : 0.22);
      if (!filled) dot.setStrokeStyle(1, d.color, 0.4);
      dots.push(dot);
    }

    const parts: GameObjects.GameObject[] = [bg, label, ...dots];
    if (blurb) parts.push(blurb);
    if (showChevron) {
      parts.push(
        crispText(this, chevronX, 0, '›', {
          fontFamily: 'Arial',
          fontSize: '26px',
          color: '#aeb6e0',
        }).setOrigin(0.5)
      );
    }

    const container = this.add.container(0, 0, parts);
    container.setSize(w, h);
    container.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);

    const press = (): void => {
      paint(0x252c5c, 0.96, 0.7);
      this.tweens.add({ targets: container, scale: 0.97, duration: 90, ease: 'Sine.out' });
    };
    const release = (): void => {
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

function stackHeight(cards: GameObjects.Container[], gap: number): number {
  return cards.reduce((sum, c) => sum + c.height, 0) + gap * (cards.length - 1);
}

/** Convert a 0xRRGGBB number to a "#rrggbb" CSS string for Text colors. */
function rgbHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** The soft community line under the difficulty cards. Never shames an empty sky. */
function describeTonight(starsTonight: number, jwala: number): string {
  const stars =
    starsTonight > 0
      ? `${starsTonight.toLocaleString()} stars lit tonight`
      : 'No stars lit tonight — yours could be first';

  return jwala > 0 ? `${stars}  ·  Jwala 🔥 ${jwala}` : stars;
}
