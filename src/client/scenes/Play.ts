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
import { ambience, setSound } from '../audio/ambience';
import { NightSky } from '../ui/NightSky';
import { Onboarding, needsOnboarding } from '../ui/Onboarding';
import { crispText, texScale } from '../ui/display';
import { clamp, onLayout, type Viewport } from '../ui/layout';
import { duration, ease, enter, leaveTo, motion, tween } from '../ui/motion';
import { Pill } from '../ui/Pill';
import { MIN_TAP } from '../ui/pressable';
import { prefs } from '../ui/prefs';
import { StoryCard } from '../ui/StoryCard';
import { alpha, color, control, font, ink, space, typeScale } from '../ui/theme';
import { TEX } from '../ui/textures';
import { postComplete } from '../api';
import type { CompleteResponse } from '../../shared/api';
import type { ResultsData } from './Results';

const TAP_THRESHOLD = 12;
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

/**
 * How close the two nearest stars come, in 0–1 units. Real constellations are
 * not evenly spaced — Orion's belt sits far tighter than Cassiopeia's zigzag —
 * so a fixed tap tolerance would either swallow the belt or miss the zigzag.
 */
function closestPair(stars: readonly PuzzleStar[]): number {
  let min = 1;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      min = Math.min(min, Math.hypot(stars[i]!.x - stars[j]!.x, stars[i]!.y - stars[j]!.y));
    }
  }
  return min;
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
  private soundPill!: Pill;
  private whisperPill!: Pill;
  private storyCard: StoryCard | null = null;

  /** The three opening hints, on a first-ever play. Blocks the sky until read. */
  private tutorial: Onboarding | null = null;

  private view: Viewport = { w: 0, h: 0 };
  /** Tap tolerance, in CSS pixels. Recomputed per layout — see `hitRadius`. */
  private hitR = 28;
  /** The closest two stars come in this puzzle, in 0–1 units. */
  private starGap = 1;

  // Interaction.
  private downStar: StarView | null = null;
  private downX = 0;
  private downY = 0;
  private dragging = false;
  private selectedStar: StarView | null = null;
  /** This press landed on a HUD pill, so the sky underneath must ignore it. */
  private hudPress = false;

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
    this.hudPress = false;
    this.complete = false;
    this.lastShownSecond = -1;
    this.glowPulse = 0;
    this.glitchHits = 0;
    this.solveMs = 0;
    this.submission = null;
    this.tutorial = null;
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
    this.starGap = closestPair(this.puzzle.stars);

    this.sky = new NightSky(this, this.night);

    this.outlineGfx = this.add.graphics();
    this.connectionGfx = this.add.graphics();
    this.hintGfx = this.add.graphics();
    this.rubberGfx = this.add.graphics();

    this.createStars();
    this.createHud();

    // A first-ever player is told what to do before the clock starts on them.
    if (needsOnboarding()) {
      this.tutorial = new Onboarding(this, () => {
        this.tutorial = null;
        this.startTime = performance.now();
      });
    }

    onLayout(this, (view) => this.layout(view));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.tutorial?.destroy());
    this.registerInput();

    // Gentle entrance.
    enter(this);
  }

  override update(): void {
    if (this.tutorial || this.complete || !this.puzzle.params.timed) return;
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
        .setTint(color.starGlow)
        .setAlpha(0.55);
      const core = this.add.image(0, 0, TEX.starSoft).setScale(texScale(0.18)).setTint(color.starCore);
      const container = this.add.container(0, 0, [glow, core]);
      const view: StarView = { data, container, glow, core };
      this.starViews.push(view);
      this.byId.set(data.id, view);

      // Each star breathes at its own tempo, so the field never pulses in unison.
      motion(this, {
        targets: glow,
        scale: texScale(0.5),
        alpha: 0.35,
        duration: duration.breath * (1 + (data.id % 6) * 0.14),
        yoyo: true,
        repeat: -1,
        ease: ease.inOut,
      });
    });
  }

  private createHud(): void {
    this.titleText = crispText(this, 0, 0, this.puzzle.label, {
      fontFamily: font.serif,
      fontSize: `${typeScale.title}px`,
      color: ink.bright,
    }).setOrigin(0.5);

    this.hintText = crispText(this, 0, 0, this.buildHintLabel(), {
      fontFamily: font.sans,
      fontSize: `${typeScale.body}px`,
      color: ink.muted,
    }).setOrigin(0.5);

    this.backPill = new Pill(this, '‹ Back', { minWidth: 72 }, () => leaveTo(this, 'MainMenu'));

    this.soundPill = new Pill(this, soundIcon(), { minWidth: control.md, paddingX: space.sm }, () =>
      this.toggleSound()
    );
    this.soundPill.setActive(prefs.sound);

    this.timerPill = new Pill(this, '0:00', { minWidth: TIMER_W });
    this.timerPill.setVisible(this.puzzle.params.timed);

    this.whisperPill = new Pill(this, '', { minWidth: 150 }, () => this.useWhisper());
    this.updateWhisperButton();
    this.whisperPill.setVisible(this.puzzle.params.maxWhispers > 0);
  }

  private toggleSound(): void {
    setSound(!prefs.sound);
    this.soundPill.setLabel(soundIcon()).setActive(prefs.sound);
  }

  /**
   * The one line that has to make the mode obvious before the player draws
   * anything: it names the mode, then names what this mode gives and takes.
   */
  private buildHintLabel(): string {
    const { showOutline, showStarCountHint, maxWhispers } = this.puzzle.params;
    if (showOutline) return 'Easy · trace the glowing outline';
    if (showStarCountHint) {
      return `Medium · ${this.puzzle.realStarCount} true stars · avoid the Glitches`;
    }
    return `Hard · no outline, no count · ${maxWhispers} Whispers`;
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

    const sidePad = clamp(space.md, w * 0.045, space.xl + space.xs);
    const topPad = clamp(space.sm, h * 0.022, space.lg);
    const rowY = topPad + control.md / 2;

    const controlGap = space.sm;
    this.backPill.setPosition(sidePad + this.backPill.width / 2, rowY);
    this.soundPill.setPosition(sidePad + this.backPill.width + controlGap + this.soundPill.width / 2, rowY);
    this.timerPill.setPosition(w - sidePad - this.timerPill.width / 2, rowY);

    this.titleText.setFontSize(w < NARROW_W ? typeScale.lead : typeScale.title);
    this.hintText.setFontSize(w < NARROW_W ? typeScale.caption : typeScale.body);
    this.hintText.setWordWrapWidth(w - sidePad * 2);

    const leftGroup = this.backPill.width + controlGap + this.soundPill.width;
    const flank = Math.max(leftGroup, this.puzzle.params.timed ? this.timerPill.width : 0);
    // The breathing room is real: a title that only *just* clears the pills reads
    // as a collision even when it technically isn't.
    const inline = this.titleText.width <= w - 2 * (sidePad + flank) - space.xxl;

    const titleY = inline ? rowY : topPad + control.md + space.sm + this.titleText.height / 2;
    this.titleText.setPosition(w / 2, titleY);
    this.hintText.setPosition(w / 2, titleY + this.titleText.height / 2 + space.xs + this.hintText.height / 2);

    const topBar = this.hintText.y + this.hintText.height / 2 + clamp(space.sm, h * 0.02, space.lg);

    const bottomPad = clamp(space.sm, h * 0.022, space.lg);
    const whisperVisible = this.whisperPill.visible;
    if (whisperVisible) this.whisperPill.setPosition(w / 2, h - bottomPad - control.md / 2);
    const bottomBar = whisperVisible ? bottomPad + control.md + space.md : bottomPad + space.sm;

    const avail = Math.max(120, h - topBar - bottomBar);
    const size = Math.min(w - sidePad * 2, avail);
    const ox = (w - size) / 2;
    const oy = topBar + (avail - size) / 2;
    // Never below a fingertip's radius, however tightly this constellation packs.
    this.hitR = clamp(MIN_TAP / 2, this.starGap * size * 0.6, 34);

    for (const sv of this.starViews) {
      sv.container.setPosition(ox + sv.data.x * size, oy + sv.data.y * size);
    }

    this.redrawOutline();
    this.redrawConnections();

    if (this.overlay) {
      this.overlay.clear();
      this.overlay.fillStyle(color.void, alpha.veil);
      this.overlay.fillRect(0, 0, w, h);
    }
    // The card wraps its story to the viewport, so a resize has to rebuild it.
    this.storyCard?.show(view, false);
    this.tutorial?.layout(view);
  }

  /** Tap tolerance: generous where the sky is empty, precise where stars crowd. */
  private hitRadius(): number {
    return this.hitR;
  }

  /* ---------------------------------------------------------------- *
   *  Drawing
   * ---------------------------------------------------------------- */

  /**
   * Easy's guide. Two passes — a wide soft halo under a thin bright thread — so
   * the shape is unmistakable at a glance without ever being mistaken for a
   * thread the player has already drawn.
   */
  private redrawOutline(): void {
    this.outlineGfx.clear();
    if (!this.puzzle.params.showOutline) return;
    for (const edge of this.puzzle.solution) {
      const a = this.byId.get(edge.from);
      const b = this.byId.get(edge.to);
      if (!a || !b) continue;
      this.outlineGfx.lineStyle(9, color.outline, 0.16);
      this.outlineGfx.lineBetween(a.container.x, a.container.y, b.container.x, b.container.y);
      this.outlineGfx.lineStyle(2, color.outline, 0.8);
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
      this.connectionGfx.lineStyle(this.complete ? 15 : 11, color.accentGlow, 0.1 + 0.22 * pulse);
      this.connectionGfx.lineBetween(ax, ay, ex, ey);
      this.connectionGfx.lineStyle(3, color.accentBright, 0.95);
      this.connectionGfx.lineBetween(ax, ay, ex, ey);
    }
  }

  private drawRubber(from: StarView, x: number, y: number): void {
    const target = this.starAt(x, y);
    const end = target && target !== from ? { x: target.container.x, y: target.container.y } : { x, y };
    this.rubberGfx.clear();
    this.rubberGfx.lineStyle(3, color.accentBright, 0.55);
    this.rubberGfx.lineBetween(from.container.x, from.container.y, end.x, end.y);
  }

  /* ---------------------------------------------------------------- *
   *  Input
   * ---------------------------------------------------------------- */

  private registerInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    // A finger lifted off the edge of the canvas never reports a `pointerup`,
    // and would otherwise leave a rubber band hanging from a star forever.
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.cancelDrag, this);
    this.input.keyboard?.on('keydown-ESC', () => leaveTo(this, 'MainMenu'));
  }

  private cancelDrag(): void {
    this.rubberGfx.clear();
    this.downStar = null;
    this.dragging = false;
    this.hudPress = false;
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

  /** Scene-level pointer handlers fire under the tutorial card too. They mustn't. */
  private busy(): boolean {
    return this.complete || this.tutorial !== null;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.busy()) return;

    // These handlers are scene-level, so they also fire for a press that landed
    // on a HUD pill. Such a press belongs to the pill alone: it must not grab a
    // star sitting behind it, nor quietly drop the star already selected.
    this.hudPress = this.input.hitTestPointer(pointer).length > 0;
    if (this.hudPress) return;

    const s = this.starAt(pointer.worldX, pointer.worldY);
    this.downStar = s;
    this.downX = pointer.worldX;
    this.downY = pointer.worldY;
    this.dragging = !!s;
    if (s) this.drawRubber(s, pointer.worldX, pointer.worldY);
    else this.clearSelection();
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.busy() || this.hudPress) return;
    if (this.dragging && this.downStar) this.drawRubber(this.downStar, pointer.worldX, pointer.worldY);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    this.rubberGfx.clear();
    const down = this.downStar;
    this.downStar = null;
    this.dragging = false;
    if (this.hudPress) {
      this.hudPress = false;
      return;
    }
    if (this.busy()) return;

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
    this.glowTo(sv, 0.9);
    motion(this, { targets: sv.container, scale: 1.25, duration: duration.fast });
  }

  private clearSelection(): void {
    const sv = this.selectedStar;
    this.selectedStar = null;
    if (!sv) return;
    this.glowTo(sv, 0.55);
    motion(this, { targets: sv.container, scale: 1, duration: duration.fast });
  }

  /**
   * The halo of a star picked up or put down.
   *
   * Under motion the star's own twinkle loop owns `glow.alpha` and reclaims it
   * the very next frame, so the swell is the cue and this stays out of the way.
   * Under stillness there is no loop and no swell — the halo is the only cue
   * left, which is exactly why it may not snap on.
   */
  private glowTo(sv: StarView, halo: number): void {
    if (prefs.animate) return;
    tween(this, { targets: sv.glow, alpha: halo, duration: duration.fast });
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

      // A thread reaching from one star to the other is travel, so under
      // stillness it is simply already there.
      const draw = motion(this, {
        targets: edge,
        progress: 1,
        duration: duration.base,
        onUpdate: () => this.redrawConnections(),
      });
      if (!draw) {
        edge.progress = 1;
        this.redrawConnections();
      }
      // A star falls across the sky, a step brighter for each thread drawn.
      ambience.connect(this.connected.size - 1);
      this.pulseStar(a);
      this.pulseStar(b);
      if (this.connected.size === this.puzzle.solution.length) this.onComplete();
    } else {
      this.wrongFeedback(a, b);
    }
  }

  private pulseStar(sv: StarView): void {
    motion(this, { targets: sv.container, scale: 1.4, duration: duration.micro, yoyo: true });
    this.flashRing(sv, color.accent);
  }

  /**
   * A ring blooming outward, or — when the player has asked for stillness — the
   * same light arriving and leaving without going anywhere. A ring that will not
   * swell is born at the size it would have swelled to, since `tween` drops the
   * `scale` and leaves it wherever it was put.
   */
  private flashRing(sv: StarView, tint: number): void {
    const ring = this.add
      .image(sv.container.x, sv.container.y, TEX.starSoft)
      .setScale(texScale(prefs.animate ? 0.2 : 0.6))
      .setTint(tint)
      .setAlpha(0.7);
    tween(this, {
      targets: ring,
      scale: texScale(0.9),
      alpha: 0,
      duration: duration.slow,
      onComplete: () => ring.destroy(),
    });
  }

  private wrongFeedback(a: StarView, b: StarView): void {
    if (a.data.isDecoy || b.data.isDecoy) this.glitchHits++;
    this.shakeStar(a);
    this.shakeStar(b);
    if (prefs.animate) this.cameras.main.shake(duration.micro, 0.003);

    if (a.data.isDecoy) this.glitchShimmer(a);
    else this.flashRing(a, color.wrong);
    if (b.data.isDecoy) this.glitchShimmer(b);
    else this.flashRing(b, color.wrong);
  }

  private shakeStar(sv: StarView): void {
    const baseX = sv.container.x;
    motion(this, {
      targets: sv.container,
      x: baseX + 7,
      duration: duration.tremor,
      yoyo: true,
      repeat: 2,
      ease: ease.inOut,
      onComplete: () => sv.container.setX(baseX),
    });
  }

  private glitchShimmer(sv: StarView): void {
    sv.core.setTint(color.glitch);
    sv.glow.setTint(color.glitch);
    this.flashRing(sv, color.glitch);

    const restore = (): void => {
      sv.container.setAngle(0);
      sv.core.setTint(color.starCore);
      sv.glow.setTint(color.starGlow);
    };

    // The cold shows for as long as the ring does, whether or not it wobbles.
    const wobble = motion(this, {
      targets: sv.container,
      angle: 9,
      duration: duration.tremor,
      yoyo: true,
      repeat: 3,
      onComplete: restore,
    });
    if (!wobble) this.time.delayedCall(duration.slow, restore);
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
    // Light, not movement: a Whisper answers a player who asked for stillness too.
    tween(this, {
      targets: state,
      alpha: 0.9,
      duration: duration.slow,
      yoyo: true,
      hold: duration.reveal,
      ease: ease.inOut,
      onUpdate: () => {
        this.hintGfx.clear();
        this.hintGfx.lineStyle(3, color.accent, state.alpha);
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

    // The Whisper button has nothing left to offer, so it withdraws rather than
    // blinking out from under the thumb that may still be near it.
    tween(this, {
      targets: this.whisperPill.container,
      alpha: 0,
      duration: duration.base,
      ease: ease.in,
      onComplete: () => this.whisperPill.setVisible(false),
    });

    // Dim the sky to focus the reveal, but lift the constellation above it.
    this.overlay = this.add.graphics().setDepth(20);
    this.overlay.fillStyle(color.void, 0);
    const overlayState = { a: 0 };
    tween(this, {
      targets: overlayState,
      a: alpha.veil,
      duration: duration.reveal,
      onUpdate: () => {
        this.overlay!.clear();
        this.overlay!.fillStyle(color.void, overlayState.a);
        this.overlay!.fillRect(0, 0, this.view.w, this.view.h);
      },
    });

    this.connectionGfx.setDepth(30);
    for (const sv of this.starViews) {
      // Each halo has been twinkling on an endless tween since `createStars`.
      // Left running it would take `alpha` straight back off the reveal below.
      this.tweens.killTweensOf(sv.glow);

      if (sv.data.isDecoy) {
        tween(this, { targets: sv.container, alpha: 0.1, duration: duration.reveal });
      } else {
        sv.container.setDepth(30);
        // The swelled halo is where a real star comes to rest, so stillness
        // takes it directly rather than being denied it with the swell.
        if (!prefs.animate) sv.glow.setScale(texScale(0.72));
        tween(this, {
          targets: sv.glow,
          scale: texScale(0.72),
          alpha: 0.75,
          duration: duration.reveal,
        });
      }
    }

    // Breathing glow on the finished line-work — or, held still, its full brightness.
    const breathe = motion(this, {
      targets: this,
      glowPulse: 1,
      duration: duration.breath,
      yoyo: true,
      repeat: -1,
      ease: ease.inOut,
      onUpdate: () => this.redrawConnections(),
    });
    if (!breathe) {
      this.glowPulse = 1;
      this.redrawConnections();
    }

    ambience.reveal();
    this.celebrate();
    this.submitResult();
    this.time.delayedCall(duration.reveal, () => this.showStoryCard());
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
    leaveTo(this, 'Results', data);
  }

  /** Sparks rising off the finished shape. Pure movement, so stillness skips it. */
  private celebrate(): void {
    if (!prefs.animate) return;
    const reals = this.starViews.filter((s) => !s.data.isDecoy);
    if (reals.length === 0) return;
    const rng = mulberry32(this.puzzle.night * 911 + 7);
    for (let i = 0; i < 16; i++) {
      const src = reals[Math.floor(rng() * reals.length)]!;
      const sp = this.add
        .image(src.container.x + (rng() - 0.5) * 22, src.container.y + (rng() - 0.5) * 22, TEX.spark)
        .setScale(texScale(0.1 + rng() * 0.16))
        .setAlpha(0)
        .setTint(color.accentBright)
        .setDepth(34);
      motion(this, {
        targets: sp,
        y: sp.y - (30 + rng() * 70),
        alpha: { from: 0, to: 0.9 },
        duration: duration.reveal * (0.8 + rng() * 0.5),
        onComplete: () =>
          motion(this, {
            targets: sp,
            alpha: 0,
            y: sp.y - 30,
            duration: duration.reveal,
            ease: ease.in,
            onComplete: () => sp.destroy(),
          }),
      });
    }
  }

  /**
   * The reward. Nothing but the myth is on this card — the numbers wait for the
   * Results screen. My Sky shows the same card when a gathered constellation is
   * tapped, so it lives in `ui/StoryCard`.
   */
  private showStoryCard(): void {
    this.storyCard = new StoryCard(this, {
      name: this.puzzle.name,
      story: this.puzzle.story,
      buttonLabel: 'Continue  ›',
      onButton: () => this.openResults(),
    });
    this.storyCard.show(this.view, true);
  }
}

function soundIcon(): string {
  return prefs.sound ? '🔊' : '🔇';
}
