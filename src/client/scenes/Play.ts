/**
 * Play — the heart of TaaraNight.
 *
 * A cozy night-sky puzzle: connect the real stars to reveal the night's
 * constellation, then a bedtime story fades in as the reward. Drag between
 * stars (or tap one then another) to draw a line; correct connections glow,
 * wrong ones give a gentle shake. Glitch decoys shimmer coldly when touched
 * but never connect.
 *
 * The puzzle is computed entirely on the client from the shared engine
 * (nightNumberAt + generatePuzzle), so this scene is self-contained and fully
 * playable before the server (Step 5) exists.
 */

import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import type { Difficulty } from '../../shared/constellations';
import { generatePuzzle, type NightlyPuzzle, type PuzzleStar } from '../../shared/puzzleEngine';
import { nightNumberAt } from '../../shared/nightSeed';
import { mulberry32 } from '../../shared/rng';

/** Cozy dark-sky palette. */
const COLORS = {
  skyTop: 0x070b1f,
  skyBottom: 0x151a3c,
  starCore: 0xfff6e0,
  starGlow: 0xbcd0ff,
  lineCore: 0xffe9c0,
  lineGlow: 0xffd27f,
  glitch: 0x7ff0ff,
  outline: 0x4a5688,
  accentNum: 0xffe3a3,
  text: '#f5f3ff',
  textMuted: '#9aa4d0',
  accent: '#ffe3a3',
};

const TAP_THRESHOLD = 12; // px of movement below which a pointer gesture counts as a tap

interface StarView {
  data: PuzzleStar;
  container: GameObjects.Container;
  glow: GameObjects.Arc;
  core: GameObjects.Arc;
}

type SceneData = { difficulty?: Difficulty };

function connKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class Play extends Scene {
  private difficulty: Difficulty = 'easy';
  private puzzle!: NightlyPuzzle;

  private starViews: StarView[] = [];
  private byId = new Map<number, StarView>();
  private solutionSet = new Set<string>();
  private connected = new Set<string>();

  // Graphics layers (back to front).
  private bgGfx!: GameObjects.Graphics;
  private outlineGfx!: GameObjects.Graphics;
  private connectionGfx!: GameObjects.Graphics;
  private hintGfx!: GameObjects.Graphics;
  private rubberGfx!: GameObjects.Graphics;

  // Decorative background stars, positioned in normalized screen space.
  private bgStarData: { x: number; y: number; r: number }[] = [];
  private bgStarArcs: GameObjects.Arc[] = [];

  // HUD.
  private titleText!: GameObjects.Text;
  private hintText!: GameObjects.Text;
  private timerText!: GameObjects.Text;
  private backText!: GameObjects.Text;
  private whisperBtn!: GameObjects.Text;
  private storyCard: GameObjects.Container | null = null;

  // Play-area mapping (a centered square the 0–1 puzzle box maps into).
  private area = { ox: 0, oy: 0, size: 0 };

  // Interaction state.
  private downStar: StarView | null = null;
  private downX = 0;
  private downY = 0;
  private dragging = false;
  private selectedStar: StarView | null = null;

  // Progress / status.
  private complete = false;
  private whispersLeft = 0;
  private startTime = 0;
  private lastShownSecond = -1;
  private glowPulse = 0;

  constructor() {
    super('Play');
  }

  init(data: SceneData): void {
    this.difficulty = data.difficulty ?? 'easy';

    // Scene instances are reused, so clear all state on (re)entry.
    this.starViews = [];
    this.byId = new Map();
    this.solutionSet = new Set();
    this.connected = new Set();
    this.bgStarData = [];
    this.bgStarArcs = [];
    this.storyCard = null;
    this.downStar = null;
    this.selectedStar = null;
    this.dragging = false;
    this.complete = false;
    this.lastShownSecond = -1;
    this.glowPulse = 0;
  }

  create(): void {
    const night = Math.max(1, nightNumberAt(Date.now()));
    this.puzzle = generatePuzzle(night, this.difficulty);
    this.whispersLeft = this.puzzle.params.maxWhispers;
    this.startTime = this.time.now;

    // Solution edges (undirected) for quick validity checks.
    for (const edge of this.puzzle.solution) {
      this.solutionSet.add(connKey(edge.from, edge.to));
    }

    // Graphics layers, back to front.
    this.bgGfx = this.add.graphics();
    this.outlineGfx = this.add.graphics();
    this.connectionGfx = this.add.graphics();
    this.hintGfx = this.add.graphics();
    this.rubberGfx = this.add.graphics();

    this.createBackgroundStars(night);
    this.createStars();
    this.createHud();
    this.layout();

    this.scale.on('resize', this.layout, this);
    this.registerInput();

    // Clean up scene-level listeners when leaving.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layout, this);
    });
  }

  override update(): void {
    if (this.complete || !this.puzzle.params.timed) return;
    const seconds = Math.floor((this.time.now - this.startTime) / 1000);
    if (seconds !== this.lastShownSecond) {
      this.lastShownSecond = seconds;
      this.timerText.setText(mmss(seconds));
    }
  }

  /* ------------------------------------------------------------------ *
   *  Construction
   * ------------------------------------------------------------------ */

  private createBackgroundStars(night: number): void {
    // Deterministic, cozy scatter (seeded so it looks stable, never Math.random).
    const rng = mulberry32(night * 2654435761);
    const count = 70;
    for (let i = 0; i < count; i++) {
      this.bgStarData.push({ x: rng(), y: rng(), r: 0.6 + rng() * 1.6 });
      const arc = this.add.arc(0, 0, 1, 0, 360, false, 0xffffff, 0.5);
      this.bgStarArcs.push(arc);
      // Gentle twinkle.
      this.tweens.add({
        targets: arc,
        alpha: 0.15 + rng() * 0.25,
        duration: 1400 + rng() * 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
  }

  private createStars(): void {
    this.puzzle.stars.forEach((data) => {
      const glow = this.add.arc(0, 0, 12, 0, 360, false, COLORS.starGlow, 0.28);
      const core = this.add.arc(0, 0, 5, 0, 360, false, COLORS.starCore, 1);
      const container = this.add.container(0, 0, [glow, core]);
      const view: StarView = { data, container, glow, core };
      this.starViews.push(view);
      this.byId.set(data.id, view);

      // Subtle resting twinkle on the glow.
      this.tweens.add({
        targets: glow,
        scale: 1.25,
        alpha: 0.42,
        duration: 1600 + (data.id % 5) * 220,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });
  }

  private createHud(): void {
    this.titleText = this.add
      .text(0, 0, this.puzzle.label, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: COLORS.text,
      })
      .setOrigin(0.5);

    this.hintText = this.add
      .text(0, 0, this.buildHintLabel(), {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: COLORS.textMuted,
      })
      .setOrigin(0.5);

    this.timerText = this.add
      .text(0, 0, this.puzzle.params.timed ? '0:00' : '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.textMuted,
      })
      .setOrigin(1, 0.5);

    this.backText = this.add
      .text(0, 0, '‹ Back', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: COLORS.textMuted,
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('MainMenu'));

    this.whisperBtn = this.add
      .text(0, 0, '', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: COLORS.accent,
        backgroundColor: '#20264f',
        padding: { x: 16, y: 9 } as Phaser.Types.GameObjects.Text.TextPadding,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.useWhisper());
    this.updateWhisperButton();
    // Whispers are offered when there's no outline to lean on (medium/hard).
    this.whisperBtn.setVisible(!this.puzzle.params.showOutline && this.puzzle.params.maxWhispers > 0);
  }

  private buildHintLabel(): string {
    if (this.puzzle.params.showOutline) return 'Trace the glowing outline';
    if (this.puzzle.params.showStarCountHint) {
      return `Connect ${this.puzzle.realStarCount} stars · avoid the Glitches`;
    }
    return 'Find the hidden constellation';
  }

  /* ------------------------------------------------------------------ *
   *  Layout (responsive)
   * ------------------------------------------------------------------ */

  private layout(): void {
    const { width, height } = this.scale;
    this.cameras.resize(width, height);

    // Sky gradient.
    this.bgGfx.clear();
    this.bgGfx.fillGradientStyle(COLORS.skyTop, COLORS.skyTop, COLORS.skyBottom, COLORS.skyBottom, 1);
    this.bgGfx.fillRect(0, 0, width, height);

    // Background stars.
    this.bgStarArcs.forEach((arc, i) => {
      const d = this.bgStarData[i]!;
      arc.setPosition(d.x * width, d.y * height).setRadius(d.r);
    });

    // Centered square play area, leaving room for the HUD bars.
    const topBar = 78;
    const bottomBar = 88;
    const avail = height - topBar - bottomBar;
    const size = Math.min(width * 0.92, avail);
    const ox = (width - size) / 2;
    const oy = topBar + (avail - size) / 2;
    this.area = { ox, oy, size };

    // Position stars.
    for (const sv of this.starViews) {
      sv.container.setPosition(ox + sv.data.x * size, oy + sv.data.y * size);
    }

    this.redrawOutline();
    this.redrawConnections();

    // HUD.
    this.titleText.setPosition(width / 2, 26);
    this.hintText.setPosition(width / 2, 52);
    this.timerText.setPosition(width - 16, 26);
    this.backText.setPosition(16, 26);
    this.whisperBtn.setPosition(width / 2, height - 44);

    if (this.storyCard) this.storyCard.setPosition(width / 2, height / 2);
  }

  private hitRadius(): number {
    return Math.max(26, this.area.size * 0.06);
  }

  /* ------------------------------------------------------------------ *
   *  Drawing helpers
   * ------------------------------------------------------------------ */

  private redrawOutline(): void {
    this.outlineGfx.clear();
    if (!this.puzzle.params.showOutline) return;
    this.outlineGfx.lineStyle(2, COLORS.outline, 0.5);
    for (const edge of this.puzzle.solution) {
      const a = this.byId.get(edge.from);
      const b = this.byId.get(edge.to);
      if (!a || !b) continue;
      this.outlineGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
    }
  }

  private redrawConnections(): void {
    this.connectionGfx.clear();
    const pulse = this.complete ? 0.5 + 0.5 * this.glowPulse : 0.35;
    for (const key of this.connected) {
      const [i, j] = key.split('-').map(Number) as [number, number];
      const a = this.byId.get(i);
      const b = this.byId.get(j);
      if (!a || !b) continue;
      // Soft outer glow.
      this.connectionGfx.lineStyle(this.complete ? 14 : 10, COLORS.lineGlow, 0.12 + 0.22 * pulse);
      this.connectionGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
      // Bright inner core.
      this.connectionGfx.lineStyle(3, COLORS.lineCore, 0.95);
      this.connectionGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
    }
  }

  private drawRubber(from: StarView, x: number, y: number): void {
    const target = this.starAt(x, y);
    const end = target && target !== from ? { x: target.container.x, y: target.container.y } : { x, y };
    this.rubberGfx.clear();
    this.rubberGfx.lineStyle(3, COLORS.lineCore, 0.5);
    this.rubberGfx.lineBetween(from.container.x, from.container.y, end.x, end.y);
  }

  /* ------------------------------------------------------------------ *
   *  Input
   * ------------------------------------------------------------------ */

  private registerInput(): void {
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'));
  }

  private starAt(x: number, y: number): StarView | null {
    let best: StarView | null = null;
    let bestDist = this.hitRadius();
    for (const sv of this.starViews) {
      const d = Phaser.Math.Distance.Between(x, y, sv.container.x, sv.container.y);
      if (d <= bestDist) {
        bestDist = d;
        best = sv;
      }
    }
    return best;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.complete) return;
    const s = this.starAt(pointer.x, pointer.y);
    this.downStar = s;
    this.downX = pointer.x;
    this.downY = pointer.y;
    this.dragging = !!s;
    if (s) this.drawRubber(s, pointer.x, pointer.y);
    else this.clearSelection();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragging && this.downStar) this.drawRubber(this.downStar, pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.rubberGfx.clear();
    const down = this.downStar;
    this.downStar = null;
    this.dragging = false;
    if (this.complete) return;

    const moved = Phaser.Math.Distance.Between(this.downX, this.downY, pointer.x, pointer.y);

    if (moved < TAP_THRESHOLD) {
      // Tap gesture: tap one star then another to connect them.
      if (!down) {
        this.clearSelection();
        return;
      }
      if (this.selectedStar && this.selectedStar !== down) {
        const from = this.selectedStar;
        this.clearSelection();
        this.attemptConnect(from, down);
      } else if (this.selectedStar === down) {
        this.clearSelection();
      } else {
        this.selectStar(down);
      }
      return;
    }

    // Drag gesture: from the pressed star to whatever star we released on.
    const up = this.starAt(pointer.x, pointer.y);
    if (down && up && up !== down) {
      this.clearSelection();
      this.attemptConnect(down, up);
    }
  }

  private selectStar(sv: StarView): void {
    this.clearSelection();
    this.selectedStar = sv;
    sv.glow.setAlpha(0.6);
    this.tweens.add({ targets: sv.container, scale: 1.2, duration: 160, ease: 'Sine.out' });
  }

  private clearSelection(): void {
    const sv = this.selectedStar;
    this.selectedStar = null;
    if (!sv) return;
    sv.glow.setAlpha(0.28);
    this.tweens.add({ targets: sv.container, scale: 1, duration: 160, ease: 'Sine.out' });
  }

  /* ------------------------------------------------------------------ *
   *  Connection logic
   * ------------------------------------------------------------------ */

  private attemptConnect(a: StarView, b: StarView): void {
    const key = connKey(a.data.id, b.data.id);

    if (this.connected.has(key)) {
      this.pulseStar(a);
      this.pulseStar(b);
      return;
    }

    if (this.solutionSet.has(key)) {
      this.connected.add(key);
      this.redrawConnections();
      this.pulseStar(a);
      this.pulseStar(b);
      if (this.connected.size === this.puzzle.solution.length) this.onComplete();
    } else {
      this.wrongFeedback(a, b);
    }
  }

  private pulseStar(sv: StarView): void {
    this.tweens.add({ targets: sv.container, scale: 1.35, duration: 130, yoyo: true, ease: 'Sine.out' });
  }

  private wrongFeedback(a: StarView, b: StarView): void {
    this.shakeStar(a);
    this.shakeStar(b);
    this.cameras.main.shake(120, 0.003);
    if (a.data.isDecoy) this.glitchShimmer(a);
    if (b.data.isDecoy) this.glitchShimmer(b);
  }

  private shakeStar(sv: StarView): void {
    const baseX = sv.container.x;
    this.tweens.add({
      targets: sv.container,
      x: baseX + 7,
      duration: 55,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.inOut',
      onComplete: () => sv.container.setX(baseX),
    });
  }

  private glitchShimmer(sv: StarView): void {
    sv.core.setFillStyle(COLORS.glitch, 1);
    sv.glow.setFillStyle(COLORS.glitch, 0.5);
    this.tweens.add({
      targets: sv.container,
      angle: 8,
      duration: 45,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        sv.container.setAngle(0);
        sv.core.setFillStyle(COLORS.starCore, 1);
        sv.glow.setFillStyle(COLORS.starGlow, 0.28);
      },
    });
  }

  /* ------------------------------------------------------------------ *
   *  Whispers (hints)
   * ------------------------------------------------------------------ */

  private updateWhisperButton(): void {
    this.whisperBtn.setText(`✨ Whisper · ${this.whispersLeft}`);
    this.whisperBtn.setAlpha(this.whispersLeft > 0 ? 1 : 0.4);
  }

  private useWhisper(): void {
    if (this.complete || this.whispersLeft <= 0) return;

    // Reveal the first not-yet-connected correct edge as a fading hint.
    let hintKey: string | null = null;
    for (const key of this.solutionSet) {
      if (!this.connected.has(key)) {
        hintKey = key;
        break;
      }
    }
    if (!hintKey) return;

    const [i, j] = hintKey.split('-').map(Number) as [number, number];
    const a = this.byId.get(i);
    const b = this.byId.get(j);
    if (!a || !b) return;

    this.whispersLeft--;
    this.updateWhisperButton();

    this.tweens.killTweensOf(this.hintGfx);
    const state = { alpha: 0 };
    this.tweens.add({
      targets: state,
      alpha: 0.9,
      duration: 500,
      yoyo: true,
      hold: 900,
      ease: 'Sine.inOut',
      onUpdate: () => {
        this.hintGfx.clear();
        this.hintGfx.lineStyle(3, COLORS.accentNum, state.alpha);
        this.hintGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
      },
      onComplete: () => this.hintGfx.clear(),
    });
  }

  /* ------------------------------------------------------------------ *
   *  Completion — the reward
   * ------------------------------------------------------------------ */

  private onComplete(): void {
    this.complete = true;
    this.clearSelection();
    this.rubberGfx.clear();
    this.hintGfx.clear();
    this.whisperBtn.setVisible(false);

    // Fade decoys away; brighten the real stars.
    for (const sv of this.starViews) {
      if (sv.data.isDecoy) {
        this.tweens.add({ targets: sv.container, alpha: 0.12, duration: 700, ease: 'Sine.out' });
      } else {
        this.tweens.add({ targets: sv.glow, scale: 1.6, alpha: 0.6, duration: 900, ease: 'Sine.out' });
      }
    }

    // Breathing glow on the finished line-work.
    this.tweens.add({
      targets: this,
      glowPulse: 1,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      onUpdate: () => this.redrawConnections(),
    });

    // Reveal the story a beat later — the emotional payoff.
    this.time.delayedCall(750, () => this.showStoryCard());
  }

  private showStoryCard(): void {
    const { width, height } = this.scale;
    const cardW = Math.min(width * 0.88, 560);
    const wrap = cardW - 44;

    const name = this.add
      .text(0, 0, this.puzzle.name, {
        fontFamily: 'Arial',
        fontSize: '26px',
        color: COLORS.accent,
        align: 'center',
      })
      .setOrigin(0.5);

    const story = this.add
      .text(0, 0, this.puzzle.story, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: COLORS.text,
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: wrap },
      })
      .setOrigin(0.5);

    const button = this.add
      .text(0, 0, 'Return to the sky', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#0b0f28',
        backgroundColor: COLORS.accent,
        padding: { x: 20, y: 11 } as Phaser.Types.GameObjects.Text.TextPadding,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.start('MainMenu'));

    const padTop = 26;
    const gap = 16;
    const btnGap = 22;
    const padBottom = 26;
    const contentH = name.height + gap + story.height + btnGap + button.height;
    const cardH = padTop + contentH + padBottom;
    const top = -cardH / 2;

    name.setY(top + padTop + name.height / 2);
    story.setY(name.y + name.height / 2 + gap + story.height / 2);
    button.setY(story.y + story.height / 2 + btnGap + button.height / 2);

    const bg = this.add.graphics();
    bg.fillStyle(0x10162f, 0.95);
    bg.fillRoundedRect(-cardW / 2, top, cardW, cardH, 20);
    bg.lineStyle(1.5, COLORS.lineGlow, 0.6);
    bg.strokeRoundedRect(-cardW / 2, top, cardW, cardH, 20);

    const card = this.add.container(width / 2, height / 2 + 20, [bg, name, story, button]);
    card.setAlpha(0);
    this.storyCard = card;

    this.tweens.add({
      targets: card,
      alpha: 1,
      y: height / 2,
      duration: 1500,
      ease: 'Sine.out',
    });
  }
}
