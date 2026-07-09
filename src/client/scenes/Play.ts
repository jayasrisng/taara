/**
 * Play — the heart of TaaraNight.
 *
 * Connect the real stars to reveal the night's constellation, then a bedtime
 * story rises in as the reward. Drag between stars (or tap one then another) to
 * draw a line; correct edges bloom into being, wrong ones shake gently, and
 * Glitch decoys shimmer cold-cyan but never connect.
 *
 * The puzzle is computed on the client from the shared engine, from the night
 * the menu hands over — the post's own night, so an archive post reveals the
 * constellation it was born under. Without one, tonight is the sensible guess.
 */

import { Scene, GameObjects } from 'phaser';
import * as Phaser from 'phaser';
import type { Difficulty } from '../../shared/constellations';
import { generatePuzzle, type NightlyPuzzle, type PuzzleStar } from '../../shared/puzzleEngine';
import { nightNumberAt } from '../../shared/nightSeed';
import { mulberry32 } from '../../shared/rng';
import { NightSky } from '../ui/NightSky';
import { crispText, texScale } from '../ui/display';
import { clamp, onLayout, type Viewport } from '../ui/layout';
import { Pill } from '../ui/Pill';
import { TEX } from '../ui/textures';
import { postComplete } from '../api';
import type { CompleteResponse } from '../../shared/api';
import type { ResultsData } from './Results';

const COLORS = {
  starCore: 0xfff6e0,
  starGlow: 0xbcd0ff,
  lineCore: 0xffe9c0,
  lineGlow: 0xffd27f,
  glitch: 0x7ff0ff,
  outline: 0x51608f,
  accent: 0xffe3a3,
  wrong: 0xff8f9a,
  text: '#f5f3ff',
  textMuted: '#a7b0da',
  accentText: '#ffe3a3',
};

const TAP_THRESHOLD = 12;
/** Tall enough to be a comfortable thumb target on mobile. Matches `Pill`'s default. */
const PILL_H = 40;
/** Wide enough that a two-digit-minute timer never grows the pill mid-solve. */
const TIMER_W = 78;
/** Below this width the HUD stacks its title under the pill row. */
const NARROW_W = 420;

interface StarView {
  data: PuzzleStar;
  container: GameObjects.Container;
  glow: GameObjects.Image;
  core: GameObjects.Image;
}

interface Edge {
  a: StarView;
  b: StarView;
  progress: number;
}

type SceneData = { difficulty?: Difficulty; night?: number };

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
  private night = 1;
  private puzzle!: NightlyPuzzle;

  private sky!: NightSky;
  private starViews: StarView[] = [];
  private byId = new Map<number, StarView>();
  private solutionSet = new Set<string>();
  private connected = new Set<string>();
  private edges: Edge[] = [];

  private outlineGfx!: GameObjects.Graphics;
  private connectionGfx!: GameObjects.Graphics;
  private hintGfx!: GameObjects.Graphics;
  private rubberGfx!: GameObjects.Graphics;
  private overlay: GameObjects.Graphics | null = null;

  // HUD.
  private titleText!: GameObjects.Text;
  private hintText!: GameObjects.Text;
  private timerPill!: Pill;
  private backPill!: Pill;
  private whisperPill!: Pill;
  private storyCard: GameObjects.Container | null = null;

  private view: Viewport = { w: 0, h: 0 };
  private area = { ox: 0, oy: 0, size: 0 };

  // Interaction.
  private downStar: StarView | null = null;
  private downX = 0;
  private downY = 0;
  private dragging = false;
  private selectedStar: StarView | null = null;

  // Status.
  private complete = false;
  private whispersLeft = 0;
  private startTime = 0;
  private lastShownSecond = -1;
  private glowPulse = 0;
  private glitchHits = 0;
  /** How long the solve took, frozen at completion. */
  private solveMs = 0;

  /** The write of tonight's result, handed to Results so it need not race it. */
  private submission: Promise<CompleteResponse | null> | null = null;

  constructor() {
    super('Play');
  }

  init(data: SceneData): void {
    this.difficulty = data.difficulty ?? 'easy';
    this.night = data.night ?? Math.max(1, nightNumberAt(Date.now()));
    this.starViews = [];
    this.byId = new Map();
    this.solutionSet = new Set();
    this.connected = new Set();
    this.edges = [];
    this.overlay = null;
    this.storyCard = null;
    this.downStar = null;
    this.selectedStar = null;
    this.dragging = false;
    this.complete = false;
    this.lastShownSecond = -1;
    this.glowPulse = 0;
    this.glitchHits = 0;
    this.solveMs = 0;
    this.submission = null;
  }

  create(): void {
    this.puzzle = generatePuzzle(this.night, this.difficulty);
    this.whispersLeft = this.puzzle.params.maxWhispers;
    // Not `this.time.now`: the scene Clock has not ticked when `create` runs, so
    // it still reads 0 and the timer would count from page load, not from now.
    this.startTime = performance.now();

    for (const edge of this.puzzle.solution) {
      this.solutionSet.add(connKey(edge.from, edge.to));
    }

    this.sky = new NightSky(this, this.night);

    this.outlineGfx = this.add.graphics();
    this.connectionGfx = this.add.graphics();
    this.hintGfx = this.add.graphics();
    this.rubberGfx = this.add.graphics();

    this.createStars();
    this.createHud();

    onLayout(this, (view) => this.layout(view));
    this.registerInput();

    // Gentle entrance.
    this.cameras.main.fadeIn(500, 5, 6, 15);
  }

  override update(): void {
    if (this.complete || !this.puzzle.params.timed) return;
    const seconds = Math.floor((performance.now() - this.startTime) / 1000);
    if (seconds !== this.lastShownSecond) {
      this.lastShownSecond = seconds;
      this.timerPill.setLabel(mmss(seconds));
    }
  }

  /* ---------------------------------------------------------------- *
   *  Construction
   * ---------------------------------------------------------------- */

  private createStars(): void {
    this.puzzle.stars.forEach((data) => {
      const glow = this.add
        .image(0, 0, TEX.starSoft)
        .setScale(texScale(0.42))
        .setTint(COLORS.starGlow)
        .setAlpha(0.55);
      const core = this.add.image(0, 0, TEX.starSoft).setScale(texScale(0.18)).setTint(COLORS.starCore);
      const container = this.add.container(0, 0, [glow, core]);
      const view: StarView = { data, container, glow, core };
      this.starViews.push(view);
      this.byId.set(data.id, view);

      this.tweens.add({
        targets: glow,
        scale: texScale(0.5),
        alpha: 0.35,
        duration: 1700 + (data.id % 6) * 240,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });
  }

  private createHud(): void {
    this.titleText = crispText(this, 0, 0, this.puzzle.label, {
      fontFamily: 'Georgia, serif',
      fontSize: '20px',
      color: COLORS.text,
    }).setOrigin(0.5);

    this.hintText = crispText(this, 0, 0, this.buildHintLabel(), {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: COLORS.textMuted,
    }).setOrigin(0.5);

    this.backPill = new Pill(this, '‹ Back', { minWidth: 72 }, () => this.scene.start('MainMenu'));

    this.timerPill = new Pill(this, '0:00', { minWidth: TIMER_W });
    this.timerPill.setVisible(this.puzzle.params.timed);

    this.whisperPill = new Pill(this, '', { minWidth: 150 }, () => this.useWhisper());
    this.updateWhisperButton();
    this.whisperPill.setVisible(!this.puzzle.params.showOutline && this.puzzle.params.maxWhispers > 0);
  }

  private buildHintLabel(): string {
    if (this.puzzle.params.showOutline) return 'Trace the glowing outline';
    if (this.puzzle.params.showStarCountHint) {
      return `Connect ${this.puzzle.realStarCount} stars · avoid the Glitches`;
    }
    return 'Find the hidden constellation';
  }

  /* ---------------------------------------------------------------- *
   *  Layout
   * ---------------------------------------------------------------- */

  /**
   * The HUD reserves what it actually needs at the top and bottom; the star
   * field is the largest square that fits in between. The title sits inline
   * between the Back and timer pills only when it genuinely fits there —
   * otherwise it drops onto its own row rather than running under them.
   */
  private layout(view: Viewport): void {
    this.view = view;
    const { w, h } = view;
    this.sky.layout(view);

    const sidePad = clamp(12, w * 0.045, 28);
    const topPad = clamp(10, h * 0.022, 18);
    const rowY = topPad + PILL_H / 2;

    this.backPill.setPosition(sidePad + this.backPill.width / 2, rowY);
    this.timerPill.setPosition(w - sidePad - this.timerPill.width / 2, rowY);

    this.titleText.setFontSize(w < NARROW_W ? 17 : 20);
    this.hintText.setFontSize(w < NARROW_W ? 12 : 14);

    const flank = Math.max(this.backPill.width, this.puzzle.params.timed ? this.timerPill.width : 0);
    // The 32 is breathing room: a title that only *just* clears the pills reads
    // as a collision even when it technically isn't.
    const inline = this.titleText.width <= w - 2 * (sidePad + flank) - 32;

    const titleY = inline ? rowY : topPad + PILL_H + 10 + this.titleText.height / 2;
    this.titleText.setPosition(w / 2, titleY);
    this.hintText.setPosition(w / 2, titleY + this.titleText.height / 2 + 4 + this.hintText.height / 2);

    const topBar = this.hintText.y + this.hintText.height / 2 + clamp(8, h * 0.02, 18);

    const bottomPad = clamp(10, h * 0.022, 18);
    const whisperVisible = this.whisperPill.visible;
    if (whisperVisible) this.whisperPill.setPosition(w / 2, h - bottomPad - PILL_H / 2);
    const bottomBar = whisperVisible ? bottomPad + PILL_H + 12 : bottomPad + 8;

    const avail = Math.max(120, h - topBar - bottomBar);
    const size = Math.min(w - sidePad * 2, avail);
    const ox = (w - size) / 2;
    const oy = topBar + (avail - size) / 2;
    this.area = { ox, oy, size };

    for (const sv of this.starViews) {
      sv.container.setPosition(ox + sv.data.x * size, oy + sv.data.y * size);
    }

    this.redrawOutline();
    this.redrawConnections();

    if (this.overlay) {
      this.overlay.clear();
      this.overlay.fillStyle(0x03040c, 0.5);
      this.overlay.fillRect(0, 0, w, h);
    }
    // The card wraps its story to the viewport, so a resize has to rebuild it.
    if (this.storyCard) this.showStoryCard(true);
  }

  private hitRadius(): number {
    return Math.max(28, this.area.size * 0.065);
  }

  /* ---------------------------------------------------------------- *
   *  Drawing
   * ---------------------------------------------------------------- */

  private redrawOutline(): void {
    this.outlineGfx.clear();
    if (!this.puzzle.params.showOutline) return;
    this.outlineGfx.lineStyle(2, COLORS.outline, 0.55);
    for (const edge of this.puzzle.solution) {
      const a = this.byId.get(edge.from);
      const b = this.byId.get(edge.to);
      if (!a || !b) continue;
      this.outlineGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
    }
  }

  private redrawConnections(): void {
    this.connectionGfx.clear();
    const pulse = this.complete ? 0.55 + 0.45 * this.glowPulse : 0.4;
    for (const e of this.edges) {
      const ax = e.a.container.x;
      const ay = e.a.container.y;
      const ex = ax + (e.b.container.x - ax) * e.progress;
      const ey = ay + (e.b.container.y - ay) * e.progress;
      this.connectionGfx.lineStyle(this.complete ? 15 : 11, COLORS.lineGlow, 0.1 + 0.22 * pulse);
      this.connectionGfx.lineBetween(ax, ay, ex, ey);
      this.connectionGfx.lineStyle(3, COLORS.lineCore, 0.95);
      this.connectionGfx.lineBetween(ax, ay, ex, ey);
    }
  }

  private drawRubber(from: StarView, x: number, y: number): void {
    const target = this.starAt(x, y);
    const end = target && target !== from ? { x: target.container.x, y: target.container.y } : { x, y };
    this.rubberGfx.clear();
    this.rubberGfx.lineStyle(3, COLORS.lineCore, 0.55);
    this.rubberGfx.lineBetween(from.container.x, from.container.y, end.x, end.y);
  }

  /* ---------------------------------------------------------------- *
   *  Input
   * ---------------------------------------------------------------- */

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
    const s = this.starAt(pointer.worldX, pointer.worldY);
    this.downStar = s;
    this.downX = pointer.worldX;
    this.downY = pointer.worldY;
    this.dragging = !!s;
    if (s) this.drawRubber(s, pointer.worldX, pointer.worldY);
    else this.clearSelection();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.dragging && this.downStar) this.drawRubber(this.downStar, pointer.worldX, pointer.worldY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.rubberGfx.clear();
    const down = this.downStar;
    this.downStar = null;
    this.dragging = false;
    if (this.complete) return;

    const moved = Phaser.Math.Distance.Between(this.downX, this.downY, pointer.worldX, pointer.worldY);

    if (moved < TAP_THRESHOLD) {
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

    const up = this.starAt(pointer.worldX, pointer.worldY);
    if (down && up && up !== down) {
      this.clearSelection();
      this.attemptConnect(down, up);
    }
  }

  private selectStar(sv: StarView): void {
    this.clearSelection();
    this.selectedStar = sv;
    sv.glow.setAlpha(0.9);
    this.tweens.add({ targets: sv.container, scale: 1.25, duration: 160, ease: 'Sine.out' });
  }

  private clearSelection(): void {
    const sv = this.selectedStar;
    this.selectedStar = null;
    if (!sv) return;
    sv.glow.setAlpha(0.55);
    this.tweens.add({ targets: sv.container, scale: 1, duration: 160, ease: 'Sine.out' });
  }

  /* ---------------------------------------------------------------- *
   *  Connection logic
   * ---------------------------------------------------------------- */

  private attemptConnect(a: StarView, b: StarView): void {
    const key = connKey(a.data.id, b.data.id);

    if (this.connected.has(key)) {
      this.pulseStar(a);
      this.pulseStar(b);
      return;
    }

    if (this.solutionSet.has(key)) {
      this.connected.add(key);
      const edge: Edge = { a, b, progress: 0 };
      this.edges.push(edge);
      this.tweens.add({
        targets: edge,
        progress: 1,
        duration: 260,
        ease: 'Sine.out',
        onUpdate: () => this.redrawConnections(),
      });
      this.pulseStar(a);
      this.pulseStar(b);
      if (this.connected.size === this.puzzle.solution.length) this.onComplete();
    } else {
      this.wrongFeedback(a, b);
    }
  }

  private pulseStar(sv: StarView): void {
    this.tweens.add({ targets: sv.container, scale: 1.4, duration: 130, yoyo: true, ease: 'Sine.out' });
    this.flashRing(sv, COLORS.accent);
  }

  private flashRing(sv: StarView, color: number): void {
    const ring = this.add
      .image(sv.container.x, sv.container.y, TEX.starSoft)
      .setScale(texScale(0.2))
      .setTint(color)
      .setAlpha(0.7);
    this.tweens.add({
      targets: ring,
      scale: texScale(0.9),
      alpha: 0,
      duration: 420,
      ease: 'Sine.out',
      onComplete: () => ring.destroy(),
    });
  }

  private wrongFeedback(a: StarView, b: StarView): void {
    if (a.data.isDecoy || b.data.isDecoy) this.glitchHits++;
    this.shakeStar(a);
    this.shakeStar(b);
    this.cameras.main.shake(120, 0.003);
    if (a.data.isDecoy) this.glitchShimmer(a);
    else this.flashRing(a, COLORS.wrong);
    if (b.data.isDecoy) this.glitchShimmer(b);
    else this.flashRing(b, COLORS.wrong);
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
    sv.core.setTint(COLORS.glitch);
    sv.glow.setTint(COLORS.glitch);
    this.flashRing(sv, COLORS.glitch);
    this.tweens.add({
      targets: sv.container,
      angle: 9,
      duration: 45,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        sv.container.setAngle(0);
        sv.core.setTint(COLORS.starCore);
        sv.glow.setTint(COLORS.starGlow);
      },
    });
  }

  /* ---------------------------------------------------------------- *
   *  Whispers
   * ---------------------------------------------------------------- */

  private updateWhisperButton(): void {
    this.whisperPill.setLabel(`✨ Whisper · ${this.whispersLeft}`);
    this.whisperPill.setEnabled(this.whispersLeft > 0);
  }

  private useWhisper(): void {
    if (this.complete || this.whispersLeft <= 0) return;

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
        this.hintGfx.lineStyle(3, COLORS.accent, state.alpha);
        this.hintGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
      },
      onComplete: () => this.hintGfx.clear(),
    });
  }

  /* ---------------------------------------------------------------- *
   *  Completion — the reward
   * ---------------------------------------------------------------- */

  private onComplete(): void {
    this.complete = true;
    this.solveMs = Math.round(performance.now() - this.startTime);
    this.clearSelection();
    this.rubberGfx.clear();
    this.hintGfx.clear();
    this.whisperPill.setVisible(false);

    // Dim the sky to focus the reveal, but lift the constellation above it.
    this.overlay = this.add.graphics().setDepth(20);
    this.overlay.fillStyle(0x03040c, 0);
    const overlayState = { a: 0 };
    this.tweens.add({
      targets: overlayState,
      a: 0.5,
      duration: 900,
      onUpdate: () => {
        this.overlay!.clear();
        this.overlay!.fillStyle(0x03040c, overlayState.a);
        this.overlay!.fillRect(0, 0, this.view.w, this.view.h);
      },
    });

    this.connectionGfx.setDepth(30);
    for (const sv of this.starViews) {
      if (sv.data.isDecoy) {
        this.tweens.add({ targets: sv.container, alpha: 0.1, duration: 700, ease: 'Sine.out' });
      } else {
        sv.container.setDepth(30);
        this.tweens.add({
          targets: sv.glow,
          scale: texScale(0.72),
          alpha: 0.75,
          duration: 900,
          ease: 'Sine.out',
        });
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

    this.celebrate();
    this.submitResult();
    this.time.delayedCall(750, () => this.showStoryCard(false));
  }

  /**
   * Send the night to the server, once. The story reveal never waits on the
   * network — a failure costs the player nothing but the record — so the
   * promise is kept rather than awaited, and handed to Results, which does need
   * the write to have landed before it asks what tonight looks like.
   */
  private submitResult(): void {
    if (this.submission) return;

    this.submission = postComplete({
      difficulty: this.difficulty,
      timeMs: this.solveMs,
      whispers: this.whispersUsed(),
      glitches: this.glitchHits,
    });
  }

  private whispersUsed(): number {
    return this.puzzle.params.maxWhispers - this.whispersLeft;
  }

  /** Leave the story behind and go count the night. */
  private openResults(): void {
    const data: ResultsData = {
      night: this.puzzle.night,
      difficulty: this.difficulty,
      constellationId: this.puzzle.constellationId,
      submission: this.submission ?? undefined,
      timeMs: this.solveMs,
      whispers: this.whispersUsed(),
      glitches: this.glitchHits,
    };
    this.scene.start('Results', data);
  }

  private celebrate(): void {
    const reals = this.starViews.filter((s) => !s.data.isDecoy);
    if (reals.length === 0) return;
    const rng = mulberry32(this.puzzle.night * 911 + 7);
    for (let i = 0; i < 16; i++) {
      const src = reals[Math.floor(rng() * reals.length)]!;
      const sp = this.add
        .image(src.container.x + (rng() - 0.5) * 22, src.container.y + (rng() - 0.5) * 22, TEX.spark)
        .setScale(texScale(0.1 + rng() * 0.16))
        .setAlpha(0)
        .setTint(COLORS.lineCore)
        .setDepth(34);
      this.tweens.add({
        targets: sp,
        y: sp.y - (30 + rng() * 70),
        alpha: { from: 0, to: 0.9 },
        duration: 700 + rng() * 500,
        ease: 'Sine.out',
        onComplete: () =>
          this.tweens.add({
            targets: sp,
            alpha: 0,
            y: sp.y - 30,
            duration: 700,
            onComplete: () => sp.destroy(),
          }),
      });
    }
  }

  /**
   * The bedtime story, sized to the viewport it lands in. The story font steps
   * down until the whole card clears the top and bottom margins, so the reward
   * is never cropped on a short screen. Nothing but the myth is on this card —
   * the numbers wait for the Results screen.
   *
   * `rebuild` skips the entrance tween — a resize should not replay the reveal.
   */
  private showStoryCard(rebuild: boolean): void {
    const { w, h } = this.view;
    this.storyCard?.destroy();

    const margin = clamp(12, h * 0.04, 40);
    const sidePad = clamp(12, w * 0.045, 28);
    const maxH = h - margin * 2;
    const cardW = Math.min(w - sidePad * 2, 560);
    const padX = 24;
    const wrap = cardW - padX * 2;

    const padTop = 30;
    const gap = 16;
    const btnGap = 24;
    const padBottom = 26;

    const name = crispText(this, 0, 0, this.puzzle.name, {
      fontFamily: 'Georgia, serif',
      fontSize: `${clamp(21, w * 0.075, 27)}px`,
      color: COLORS.accentText,
      align: 'center',
      fontStyle: 'italic',
      wordWrap: { width: wrap },
    }).setOrigin(0.5);
    name.setShadow(0, 0, '#ffcf8a', 14, true, true);

    const story = crispText(this, 0, 0, this.puzzle.story, {
      fontFamily: 'Georgia, serif',
      fontSize: '17px',
      color: COLORS.text,
      align: 'center',
      lineSpacing: 7,
      wordWrap: { width: wrap },
    }).setOrigin(0.5);

    const button = new Pill(this, 'Continue  ›', { minWidth: 200 }, () => this.openResults());

    const cardHeight = (): number => padTop + name.height + gap + story.height + btnGap + PILL_H + padBottom;

    let storySize = w < NARROW_W ? 15 : 17;
    story.setFontSize(storySize);
    while (cardHeight() > maxH && storySize > 11) {
      story.setFontSize(--storySize);
    }

    const cardH = cardHeight();
    const top = -cardH / 2;

    name.setY(top + padTop + name.height / 2);
    story.setY(name.y + name.height / 2 + gap + story.height / 2);
    button.container.setY(story.y + story.height / 2 + btnGap + PILL_H / 2);

    const bg = this.add.graphics();
    bg.fillStyle(0x0e1430, 0.96);
    bg.fillRoundedRect(-cardW / 2, top, cardW, cardH, 22);
    bg.lineStyle(1.5, COLORS.lineGlow, 0.55);
    bg.strokeRoundedRect(-cardW / 2, top, cardW, cardH, 22);

    const card = this.add.container(w / 2, h / 2, [bg, name, story, button.container]).setDepth(40);
    this.storyCard = card;

    if (rebuild) return;

    card.setAlpha(0).setY(h / 2 + 26);
    this.tweens.add({ targets: card, alpha: 1, y: h / 2, duration: 1500, ease: 'Sine.out' });
  }
}
