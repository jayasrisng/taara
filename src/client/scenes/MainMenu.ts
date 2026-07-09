import { Scene, GameObjects, Tweens } from 'phaser';
import { showToast } from '@devvit/web/client';
import type { InitResponse } from '../../shared/api';
import type { Difficulty } from '../../shared/constellations';
import { nightNumberAt } from '../../shared/nightSeed';
import { setSound } from '../audio/ambience';
import { NightSky } from '../ui/NightSky';
import { crispText } from '../ui/display';
import { clamp, onLayout, type Viewport } from '../ui/layout';
import { crossFade, duration, enter, leave, leaveTo, motion, tween } from '../ui/motion';
import { Pill, makePill } from '../ui/Pill';
import { pressable, tapArea } from '../ui/pressable';
import { prefs } from '../ui/prefs';
import {
  alpha,
  color,
  control,
  difficulty as difficultyColor,
  font,
  glow,
  hex,
  ink,
  radius,
  space,
  typeScale,
} from '../ui/theme';
import { fetchInit, postComplete } from '../api';

interface DiffDef {
  label: string;
  value: Difficulty;
  blurb: string;
  color: number;
  dots: number;
}

const DIFFICULTIES: DiffDef[] = [
  { label: 'Easy', value: 'easy', blurb: 'The outline is shown · no Glitches', color: difficultyColor.easy, dots: 1 },
  {
    label: 'Medium',
    value: 'medium',
    blurb: 'No outline · a few Glitches · 3 Whispers',
    color: difficultyColor.medium,
    dots: 2,
  },
  {
    label: 'Hard',
    value: 'hard',
    blurb: 'No star count · many Glitches · a soft timer',
    color: difficultyColor.hard,
    dots: 3,
  },
];

/** Never let a card shrink below a comfortable thumb. */
const MIN_CARD_H = 56;
const MAX_CARD_H = 96;

/** Below this height the "Choose your night" line is the first thing to go. */
const DENSE_H = 540;
/** Below this width the cards drop their chevron and tighten their type. */
const NARROW_W = 380;

/**
 * How long a tapped card will wait for the server to say which night this post
 * plays. Past this the client's own guess opens the sky — a slow night is worse
 * than a slightly wrong one.
 */
const NIGHT_WAIT_MS = 1500;

/** Holds the community line's place while the server is still answering. */
const LISTENING = 'Listening for tonight’s sky…';

export class MainMenu extends Scene {
  private sky!: NightSky;
  private ui: GameObjects.GameObject[] = [];
  private entered = false;
  private view: Viewport = { w: 0, h: 0 };

  /** Tonight, computed locally so the menu paints without waiting on the API. */
  private night = 1;
  /** The server's answer, kept so a tapped card can wait on it if it must. */
  private opening: Promise<InitResponse | null> | null = null;
  /** True once `night` is the post's night rather than the client's guess. */
  private synced = false;
  /** Tonight's shared numbers — a loading line until the server answers, then null if it never does. */
  private communityLine: string | null = LISTENING;
  private soundPill: Pill | null = null;

  constructor() {
    super('MainMenu');
  }

  init(): void {
    this.ui = [];
    this.entered = false;
    this.synced = false;
    this.communityLine = LISTENING;
    this.soundPill = null;
  }

  create(): void {
    this.night = Math.max(1, nightNumberAt(Date.now()));
    this.sky = new NightSky(this, this.night);

    onLayout(this, (view) => this.build(view));

    this.opening = fetchInit();
    void this.syncWithServer();

    this.input.keyboard?.on('keydown-D', () => this.scene.start('ConstellationDebug'));
    this.input.keyboard?.on('keydown-J', () => void this.rehearseLastNight());

    // The menu rises out of the same night the splash screen left behind.
    enter(this);
  }

  /** Rebuild at the current size, after content (not the viewport) changed. */
  private relayout(): void {
    if (this.view.w > 0) this.build(this.view);
  }

  /**
   * The server owns the night number and the community's numbers. The menu
   * shows its own guess first, then quietly reconciles — if the API is asleep,
   * the sky is still open.
   *
   * The guess is only ever "tonight". On an archive post the server answers with
   * the night that post was born under, which is why `openPlay` waits for it.
   */
  private async syncWithServer(): Promise<void> {
    const init = await this.opening;
    if (!this.scene.isActive()) return;

    // A sky that never answered says nothing rather than listening forever.
    if (!init) {
      this.communityLine = null;
      this.relayout();
      return;
    }

    this.night = init.night;
    this.synced = true;

    this.communityLine = describeTonight(
      init.community.starsTonight,
      init.jwala.current,
      this.isArchive()
    );
    this.relayout();
  }

  /**
   * True when this post opens a night that has already passed. Only knowable
   * once the server has answered — before that, every post looks like tonight.
   */
  private isArchive(): boolean {
    return this.synced && this.night < Math.max(1, nightNumberAt(Date.now()));
  }

  /**
   * Open the puzzle on the night this post actually plays.
   *
   * By the time anyone has read three cards the server has long since answered,
   * so this is normally instant; the race is only insurance against a stalled
   * request holding the sky shut.
   */
  private async openPlay(difficulty: Difficulty): Promise<void> {
    if (!this.synced) {
      await Promise.race([this.opening, delay(NIGHT_WAIT_MS)]);
    }
    if (!this.scene.isActive()) return;

    leaveTo(this, 'Play', { difficulty, night: this.night });
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

    const sidePad = clamp(space.md, w * 0.05, space.xxl);
    const dense = h < DENSE_H;
    const narrow = w < NARROW_W;
    const textWidth = w - sidePad * 2;

    /* ---- top block, flowing down ---- */

    let top = clamp(space.lg, h * 0.05, control.lg);

    const title = crispText(this, w / 2, top, 'TaaraNight', {
      fontFamily: font.serif,
      fontSize: `${clamp(typeScale.display, Math.min(w * 0.12, h * 0.08), typeScale.giant)}px`,
      color: ink.bright,
    }).setOrigin(0.5, 0);
    title.setShadow(0, 0, hex(color.starlight), glow.strong, true, true);
    this.ui.push(title);
    top += title.height + clamp(space.xs, h * 0.012, space.md);

    const when = this.isArchive() ? 'An older sky' : 'Tonight';
    const pill = makePill(this, w / 2, top + control.sm / 2, `🌙  ${when} · TaaraNight #${this.night}`, {
      height: control.sm,
      paddingX: space.lg,
    });
    this.ui.push(pill.container);
    top += control.sm;

    if (!dense) {
      const prompt = crispText(this, w / 2, top + clamp(space.sm, h * 0.022, space.xl - space.xs), 'Choose your night', {
        fontFamily: font.serif,
        fontSize: `${typeScale.lead}px`,
        color: ink.muted,
        fontStyle: 'italic',
      }).setOrigin(0.5, 0);
      this.ui.push(prompt);
      top = prompt.y + prompt.height;
    }

    /* ---- bottom block, flowing up ---- */

    let bottom = h - clamp(space.md, h * 0.03, space.xl + space.xs);

    const footer = crispText(this, w / 2, bottom, 'A new sky unlocks every night at 6 PM', {
      fontFamily: font.sans,
      fontSize: `${typeScale.caption}px`,
      color: ink.faint,
      align: 'center',
      wordWrap: { width: textWidth },
    }).setOrigin(0.5, 1);
    this.ui.push(footer);
    bottom -= footer.height + space.sm;

    // The gap has to clear `MIN_TAP - control.sm`: both rows are drawn 32 tall
    // but tap 44 tall, and two hit areas that touch let the wrong one win a thumb
    // landing on the seam.
    bottom = this.buildSettings(w, bottom) - space.lg;

    // My Sky is reachable without solving anything: the dome is worth looking at
    // even when it is still dark.
    const mySky = new Pill(this, '✨  My Sky', { height: control.sm, fontSize: typeScale.caption }, () =>
      leaveTo(this, 'MySky', {})
    );
    mySky.setPosition(w / 2, bottom - control.sm / 2);
    this.ui.push(mySky.container);
    bottom -= control.sm + space.sm;

    if (this.communityLine) {
      const community = crispText(this, w / 2, bottom, this.communityLine, {
        fontFamily: font.sans,
        fontSize: `${typeScale.body}px`,
        color: ink.muted,
        align: 'center',
        wordWrap: { width: textWidth },
      }).setOrigin(0.5, 1);
      this.ui.push(community);
      bottom -= community.height + space.xs;
    }

    /* ---- the cards take what is left ---- */

    const edge = clamp(space.sm, h * 0.025, space.xl + space.xs);
    const midTop = top + edge;
    const midH = Math.max(MIN_CARD_H, bottom - edge - midTop);
    const cardW = Math.min(textWidth, 460);

    let gap = clamp(space.sm, h * 0.018, space.lg);
    let cards = this.buildCards(cardW, midH, gap, narrow, false);

    // Two-line blurbs can push the stack past the space we reserved on a very
    // short screen. Rather than let it slide under the footer, the cards give
    // up their blurb — the label and the dots still say everything essential.
    if (stackHeight(cards, gap) > midH) {
      cards.forEach((c) => c.destroy());
      gap = space.sm;
      cards = this.buildCards(cardW, midH, gap, narrow, true);
    }

    let y = midTop + Math.max(0, (midH - stackHeight(cards, gap)) / 2);
    cards.forEach((card, i) => {
      const centreY = y + card.height / 2;
      card.setPosition(w / 2, centreY);
      y += card.height + gap;
      this.ui.push(card);

      // The three cards deal themselves in. Under stillness they only brighten:
      // `tween` drops the rise and leaves each card where it was placed.
      if (!this.entered) {
        card.setAlpha(0);
        if (prefs.animate) card.setY(centreY + space.xl);
        tween(this, {
          targets: card,
          alpha: 1,
          y: centreY,
          duration: duration.slow,
          delay: duration.micro * (1 + i),
        });
      }
    });

    this.entered = true;
  }

  /**
   * Sound and stillness, side by side above the footer. Returns the new bottom
   * edge, so the cards above know how much room they still have.
   */
  private buildSettings(w: number, bottom: number): number {
    const style = { height: control.sm, fontSize: typeScale.caption, paddingX: space.md };
    const y = bottom - control.sm / 2;

    const sound = new Pill(this, soundLabel(), style, () => this.toggleSound());
    sound.setActive(prefs.sound);
    this.soundPill = sound;

    const motion = new Pill(this, motionLabel(), style, () => this.toggleMotion());
    motion.setActive(prefs.animate);

    const gap = space.sm;
    const rowW = sound.width + gap + motion.width;
    sound.setPosition(w / 2 - rowW / 2 + sound.width / 2, y);
    motion.setPosition(w / 2 + rowW / 2 - motion.width / 2, y);

    this.ui.push(sound.container, motion.container);
    return bottom - control.sm;
  }

  /** The label changes in place: a whole re-layout for one word would flicker. */
  private toggleSound(): void {
    setSound(!prefs.sound);
    this.soundPill?.setLabel(soundLabel()).setActive(prefs.sound);
  }

  /**
   * Stillness has to be chosen before the sky is built — the twinkles and the
   * shooting stars are looping tweens started in `NightSky`'s constructor — so
   * the menu rebuilds itself around the new answer. It fades on the way, because
   * a screen that blinks is a poor advertisement for a calmer setting.
   */
  private toggleMotion(): void {
    prefs.set({ reducedMotion: !prefs.reducedMotion });
    leave(this, () => this.scene.restart());
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
    const padX = narrow ? space.lg + space.xs : space.xl + space.xs;
    const padY = space.md;
    const showChevron = !narrow;

    // Right-hand column: three dots, and a chevron when there is room for one.
    const dotStep = space.lg;
    const dotRight = w / 2 - padX;
    const firstDot = dotRight - dotStep * 2;
    const dotsLeft = firstDot - space.xs;
    const chevronX = dotsLeft - space.lg;
    const textRight = (showChevron ? chevronX : dotsLeft) - space.md;
    const textLeft = -w / 2 + padX;
    const textW = Math.max(60, textRight - textLeft);

    const label = crispText(this, textLeft, 0, d.label, {
      fontFamily: font.serif,
      fontSize: `${narrow ? typeScale.title : typeScale.heading}px`,
      color: hex(d.color),
    }).setOrigin(0, 0);

    const blurb = hideBlurb
      ? null
      : crispText(this, textLeft, 0, d.blurb, {
          fontFamily: font.sans,
          fontSize: `${typeScale.caption}px`,
          color: ink.muted,
          wordWrap: { width: textW },
        }).setOrigin(0, 0);

    const contentH = label.height + (blurb ? space.xs + blurb.height : 0);
    const h = Math.max(targetH, contentH + padY * 2);

    label.setY(-contentH / 2);
    blurb?.setY(-contentH / 2 + label.height + space.xs);

    const bg = this.add.graphics();
    const paint = (fill: number, lineAlpha: number): void => {
      bg.clear();
      bg.fillStyle(fill, alpha.fill);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius.card);
      bg.lineStyle(1.5, d.color, lineAlpha);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius.card);
    };
    paint(color.surface, alpha.stroke);

    // The card warms towards a fill rather than snapping to it; its border rides
    // the same curve. `shade` is the colour as it is now, so a thumb that leaves
    // mid-fade turns around from wherever the paint had got to.
    // Widened from the literal `color` tokens: these are values that travel.
    let shade: number = color.surface;
    let edge: number = alpha.stroke;
    let fading: Tweens.Tween | null = null;
    const paintTo = (fill: number, lineAlpha: number): void => {
      fading?.remove();
      const fromShade = shade;
      const fromEdge = edge;
      fading = crossFade(this, fromShade, fill, (blended, t) => {
        shade = blended;
        edge = fromEdge + (lineAlpha - fromEdge) * t;
        paint(shade, edge);
      });
    };

    // Filled from the left, so Easy lights one dot and Hard lights three.
    const dots: GameObjects.Arc[] = [];
    for (let i = 0; i < 3; i++) {
      const filled = i < d.dots;
      const dot = this.add.circle(firstDot + i * dotStep, 0, 5, d.color, filled ? 1 : 0.22);
      if (!filled) dot.setStrokeStyle(1, d.color, alpha.stroke);
      dots.push(dot);
    }

    const parts: GameObjects.GameObject[] = [bg, label, ...dots];
    if (blurb) parts.push(blurb);
    if (showChevron) {
      parts.push(
        crispText(this, chevronX, 0, '›', {
          fontFamily: font.sans,
          fontSize: `${typeScale.display}px`,
          color: ink.muted,
        }).setOrigin(0.5)
      );
    }

    const container = this.add.container(0, 0, parts);
    container.setSize(w, h);
    // A rebuild on resize drops the card; the fade must not repaint its ghost.
    container.once(GameObjects.Events.DESTROY, () => fading?.remove());

    const scaleTo = (value: number, ms: number): void => {
      motion(this, { targets: container, scale: value, duration: ms });
    };

    pressable(this, container, tapArea(w, h), {
      onClick: () => void this.openPlay(d.value),
      onHover: () => paintTo(color.surfaceHover, alpha.strokeStrong),
      onPress: () => {
        paintTo(color.surfacePress, alpha.strokeStrong);
        scaleTo(0.97, duration.micro);
      },
      onRest: () => {
        paintTo(color.surface, alpha.stroke);
        scaleTo(1, duration.fast);
      },
    });

    return container;
  }
}

/** Resolves to null after `ms`, so a promise can be raced against the clock. */
function delay(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

function stackHeight(cards: GameObjects.Container[], gap: number): number {
  return cards.reduce((sum, c) => sum + c.height, 0) + gap * (cards.length - 1);
}

function soundLabel(): string {
  return prefs.sound ? '🔊  Sound' : '🔇  Muted';
}

function motionLabel(): string {
  return prefs.animate ? '✨  Motion' : '🌙  Stillness';
}

/** The soft community line under the difficulty cards. Never shames an empty sky. */
function describeTonight(starsTonight: number, jwala: number, archive: boolean): string {
  const when = archive ? 'that night' : 'tonight';
  const stars =
    starsTonight > 0
      ? `${starsTonight.toLocaleString()} stars lit ${when}`
      : `No stars lit ${when} — yours could be first`;

  return jwala > 0 ? `${stars}  ·  Jwala 🔥 ${jwala}` : stars;
}
