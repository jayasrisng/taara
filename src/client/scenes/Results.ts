/**
 * Results — the quiet room after the story.
 *
 * Two tabs, in the order they matter at bedtime: **Tonight** (your Jwala, the
 * countdown to the next sky, what the community lit together) and **Stargazers**
 * (the soft leaderboards, deliberately last and deliberately small). My Sky is
 * no longer a tab but a place: the `MySky` scene, one tap below.
 *
 * The screen paints from what the Play scene already knew, then quietly
 * reconciles with the server. Nothing here ever waits on the network to appear.
 *
 * The share button asks the server to comment tonight's card on the post. The
 * card is spoiler-safe: it never names the constellation, only the night, the
 * player's own effort, and a mood.
 */

import * as Phaser from 'phaser';
import { Scene, GameObjects, Tweens } from 'phaser';
import { showLoginPrompt, showToast } from '@devvit/web/client';
import type {
  CompleteResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardsResponse,
  MySkyResponse,
  NightResult,
} from '../../shared/api';
import type { Difficulty } from '../../shared/constellations';
import { EMPTY_JWALA, type JwalaState } from '../../shared/jwala';
import { millisUntilNextNight } from '../../shared/nightSeed';
import { fetchInit, fetchLeaderboards, fetchMySky, postShare } from '../api';
import { NightSky } from '../ui/NightSky';
import { untilNextSky } from '../ui/countdown';
import { crispText } from '../ui/display';
import { clamp, onLayout, type Viewport } from '../ui/layout';
import { crossFade, duration, enter, leaveTo } from '../ui/motion';
import { mmss, plural, summariseNight } from '../ui/nightSummary';
import { Pill } from '../ui/Pill';
import { pressable, tapArea } from '../ui/pressable';
import { ScrollPanel } from '../ui/ScrollPanel';
import { color, control, font, glow, hex, ink, space, typeScale } from '../ui/theme';
import type { MySkyData } from './MySky';

const SHARE_LABEL = '🌙  Share tonight';
const SIGN_IN_LABEL = 'Sign in to share';
const MY_SKY_LABEL = '✨  Open My Sky';

const TABS = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'stargazers', label: 'Stargazers' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Below this width the tab labels tighten. */
const NARROW_W = 380;

/** Below this height the subtitle under the night number is the first thing to go. */
const DENSE_H = 560;

export type ResultsData = {
  night: number;
  difficulty: Difficulty;
  /** Tonight's constellation, so My Sky can mark the one just revealed. */
  constellationId: string;
  /**
   * Play's in-flight write. Results waits for it before asking the server
   * anything, so `/api/init` and `/api/share` see a stored result rather than
   * racing the submission that produced this very screen.
   */
  submission?: Promise<CompleteResponse | null> | undefined;
  /** What Play measured, shown until (or instead of) the server's own copy. */
  timeMs: number;
  whispers: number;
  glitches: number;
  /** Carried back from My Sky, so a card already posted still reads as posted. */
  alreadyShared?: boolean;
};

export class Results extends Scene {
  private params!: ResultsData;

  private sky!: NightSky;
  private panel!: ScrollPanel;
  private ui: GameObjects.GameObject[] = [];
  private pills: Pill[] = [];
  private view: Viewport = { w: 0, h: 0 };

  private tab: TabId = 'tonight';
  /** The two tab pills, kept so a swap can light one and dim the other in place. */
  private tabPills: Pill[] = [];
  /** The width the panel is filled to, so it can be refilled without a re-layout. */
  private contentW = 0;

  /** Server truth, once it answers. Until then the fallbacks below stand in. */
  private server: InitResponse | null = null;
  private mySky: MySkyResponse | null = null;
  private boards: LeaderboardsResponse | null = null;
  private boardsRequested = false;

  /** The next boundary as an absolute instant, so a rebuild never restarts the clock. */
  private nextNightAt = 0;
  private countdown: GameObjects.Text | null = null;

  private sharePill: Pill | null = null;
  private sharing = false;
  private shared = false;

  /** Set for the duration of a panel fill, so `panelText` knows where the middle is. */
  private panelWidth = 0;

  constructor() {
    super('Results');
  }

  init(data: ResultsData): void {
    this.params = data;
    this.ui = [];
    this.pills = [];
    this.tabPills = [];
    this.contentW = 0;
    this.tab = 'tonight';
    this.server = null;
    this.mySky = null;
    this.boards = null;
    this.boardsRequested = false;
    this.countdown = null;
    this.sharePill = null;
    this.sharing = false;
    this.shared = data.alreadyShared ?? false;
    this.nextNightAt = Date.now() + millisUntilNextNight();
  }

  create(): void {
    this.sky = new NightSky(this, this.params.night);
    this.panel = new ScrollPanel(this);

    onLayout(this, (view) => this.build(view));

    this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickCountdown() });
    this.input.keyboard?.on('keydown-ESC', () => leaveTo(this, 'MainMenu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel.destroy());

    void this.sync();
    // Sweeps the panel's own camera along with the main one.
    enter(this);
  }

  /* ---------------------------------------------------------------- *
   *  Data
   * ---------------------------------------------------------------- */

  /**
   * Wait for Play's submission to land, then take the server's word for
   * everything. If the network is asleep, the screen simply keeps the numbers
   * Play handed it.
   */
  private async sync(): Promise<void> {
    await this.params.submission?.catch(() => null);
    if (!this.scene.isActive()) return;

    const [server, mySky] = await Promise.all([fetchInit(), fetchMySky()]);
    if (!this.scene.isActive()) return;

    if (server) {
      this.server = server;
      this.nextNightAt = Date.now() + server.msUntilNextNight;
    }
    this.mySky = mySky;
    this.relayout();
  }

  private async loadBoards(): Promise<void> {
    if (this.boardsRequested) return;
    this.boardsRequested = true;

    const boards = await fetchLeaderboards();
    if (!this.scene.isActive()) return;
    this.boards = boards;
    // Only the panel's contents changed, so only the panel need reappear.
    if (this.tab === 'stargazers') this.refreshPanel();
  }

  /**
   * The solve this screen was opened by — always what Play measured.
   *
   * Never the server's stored result. That is write-once (the first solve of a
   * night is the one that counts), so on a replay it describes an earlier solve
   * at a difficulty the player may not have just played.
   */
  private played(): NightResult {
    return {
      night: this.params.night,
      difficulty: this.params.difficulty,
      timeMs: this.params.timeMs,
      whispers: this.params.whispers,
      glitches: this.params.glitches,
      starsConnected: this.server?.tonight?.starsConnected ?? 0,
      completedAt: this.server?.tonight?.completedAt ?? Date.now(),
    };
  }

  private jwala(): JwalaState {
    return this.server?.jwala ?? EMPTY_JWALA;
  }

  /**
   * Who is looking at this screen — which decides whether it shows a flame, an
   * invitation to sign in, or simply the fact that it is still asking.
   */
  private viewer(): 'loading' | 'anonymous' | 'known' {
    if (!this.server) return 'loading';
    return this.server.username ? 'known' : 'anonymous';
  }

  private tickCountdown(): void {
    this.countdown?.setText(untilNextSky(this.nextNightAt - Date.now()));
  }

  /* ---------------------------------------------------------------- *
   *  Sharing
   * ---------------------------------------------------------------- */

  private async share(): Promise<void> {
    if (this.sharing || this.shared) return;
    this.sharing = true;
    this.sharePill?.setLabel('Sharing…').setEnabled(false);

    const outcome = await postShare();
    this.sharing = false;
    if (!this.scene.isActive()) return;

    if (!outcome.ok) {
      showToast(outcome.message);
      this.sharePill?.setLabel(SHARE_LABEL).setEnabled(true);
      return;
    }

    this.shared = true;
    this.sharePill?.setLabel('✓ Shared').setEnabled(false);
    showToast(
      outcome.value.alreadyShared ? 'Your card is already on tonight’s post' : 'Your card is on tonight’s post'
    );
  }

  /* ---------------------------------------------------------------- *
   *  Layout
   * ---------------------------------------------------------------- */

  private relayout(): void {
    if (this.view.w > 0) this.build(this.view);
  }

  /**
   * A vertical flow, like the menu: the header grows down from the top, the
   * share row grows up from the bottom, and the scroll panel takes what is
   * genuinely left. The panel is the only thing allowed to overflow, and it
   * clips rather than collides.
   */
  private build(view: Viewport): void {
    this.view = view;
    const { w, h } = view;
    this.sky.layout(view);

    this.ui.forEach((o) => o.destroy());
    this.pills.forEach((p) => p.destroy());
    this.ui = [];
    this.pills = [];
    this.tabPills = [];
    this.countdown = null;
    this.sharePill = null;

    const sidePad = clamp(space.md, w * 0.05, space.xxl);
    const narrow = w < NARROW_W;
    const dense = h < DENSE_H;
    const contentW = w - sidePad * 2;

    /* ---- header, flowing down ---- */

    let top = clamp(space.sm, h * 0.035, space.xxl - space.xs);

    const title = crispText(this, w / 2, top, `TaaraNight #${this.params.night}`, {
      fontFamily: font.serif,
      fontSize: `${clamp(typeScale.heading, Math.min(w * 0.085, h * 0.05), typeScale.display)}px`,
      color: ink.bright,
    }).setOrigin(0.5, 0);
    title.setShadow(0, 0, hex(color.starlight), glow.soft, true, true);
    this.ui.push(title);
    top += title.height;

    if (!dense) {
      const subtitle = crispText(this, w / 2, top + space.xs, 'Tonight’s sky revealed', {
        fontFamily: font.serif,
        fontSize: `${typeScale.body}px`,
        color: ink.muted,
        fontStyle: 'italic',
      }).setOrigin(0.5, 0);
      this.ui.push(subtitle);
      top = subtitle.y + subtitle.height;
    }

    /* ---- tabs ---- */

    top += clamp(space.sm, h * 0.022, space.lg);
    const tabGap = space.sm;
    const tabW = (contentW - tabGap * (TABS.length - 1)) / TABS.length;

    TABS.forEach((tab, i) => {
      const pill = new Pill(
        this,
        tab.label,
        {
          height: control.md,
          minWidth: tabW,
          fontSize: narrow ? typeScale.caption : typeScale.body,
          paddingX: space.sm,
        },
        () => this.selectTab(tab.id)
      );
      pill.setActive(tab.id === this.tab);
      pill.setPosition(sidePad + tabW / 2 + i * (tabW + tabGap), top + control.md / 2);
      this.pills.push(pill);
      this.tabPills.push(pill);
    });
    top += control.md;

    /* ---- share row, flowing up ---- */

    let bottom = h - clamp(space.sm, h * 0.03, space.xl);

    const back = crispText(this, w / 2, bottom, 'Return to the sky', {
      fontFamily: font.sans,
      fontSize: `${typeScale.caption}px`,
      color: ink.faint,
    }).setOrigin(0.5, 1);
    // A quiet line of text, but a full-sized target: the hit area grows around
    // the glyphs rather than the type growing to meet the thumb. Its colour
    // warms and cools on the same curve every pill uses.
    let shade: number = color.textFaint;
    let warming: Tweens.Tween | null = null;
    const shadeTo = (to: number): void => {
      if (shade === to) return;
      warming?.remove();
      warming = crossFade(this, shade, to, (blended) => {
        shade = blended;
        back.setColor(hex(blended));
      });
    };
    back.once(GameObjects.Events.DESTROY, () => warming?.remove());

    pressable(this, back, tapArea(back.width, back.height), {
      onClick: () => leaveTo(this, 'MainMenu'),
      onHover: () => shadeTo(color.textMuted),
      onPress: () => shadeTo(color.accent),
      onRest: () => shadeTo(color.textFaint),
    });
    this.ui.push(back);
    // Room for the grown hit area above the text, so it never eats the share pill's edge.
    bottom -= back.height + space.lg;

    // A signed-out player cannot comment, so the button asks for the one thing
    // that would let them — rather than offering a share that will be refused.
    const anonymous = this.viewer() === 'anonymous';
    const share = new Pill(
      this,
      anonymous ? SIGN_IN_LABEL : this.shared ? '✓ Shared' : SHARE_LABEL,
      { height: control.lg, minWidth: Math.min(contentW, 280), fontSize: typeScale.body },
      () => (anonymous ? showLoginPrompt() : void this.share())
    );
    share.setPosition(w / 2, bottom - control.lg / 2);
    share.setEnabled(anonymous || (this.viewer() === 'known' && !this.shared && !this.sharing));
    this.sharePill = share;
    this.pills.push(share);
    bottom -= control.lg + space.sm;

    const mySky = new Pill(
      this,
      MY_SKY_LABEL,
      { height: control.md, minWidth: Math.min(contentW, 280), fontSize: typeScale.body },
      () => this.openMySky()
    );
    mySky.setPosition(w / 2, bottom - control.md / 2);
    this.pills.push(mySky);
    bottom -= control.md + space.sm;

    /* ---- the panel takes what is left ---- */

    const panelTop = top + clamp(space.sm, h * 0.02, space.lg);
    const panelH = Math.max(80, bottom - panelTop);
    this.contentW = contentW;
    this.panel.setBounds(sidePad, panelTop, contentW, panelH);
    this.fillPanel(contentW);
  }

  /**
   * A tab swap is not a new screen. The pills warm and cool where they stand,
   * and only the panel's contents are exchanged — behind its own fade, so a
   * screenful of numbers is never seen being replaced.
   */
  private selectTab(tab: TabId): void {
    if (this.tab === tab) return;
    this.tab = tab;
    if (tab === 'stargazers') void this.loadBoards();

    TABS.forEach((candidate, i) => this.tabPills[i]?.setActive(candidate.id === tab));
    this.refreshPanel();
  }

  /** Re-fill the panel in place and let its contents arrive rather than appear. */
  private refreshPanel(): void {
    if (this.contentW === 0) return;
    this.fillPanel(this.contentW);
    this.panel.fadeIn(duration.base);
  }

  /**
   * My Sky is a whole night sky, so it gets a whole screen. It carries this
   * screen's state with it and hands it back on the way out, so returning here
   * does not undo a card the player already shared.
   */
  private openMySky(): void {
    const data: MySkyData = {
      tonight: { constellationId: this.params.constellationId, night: this.params.night },
      results: { ...this.params, alreadyShared: this.shared },
    };
    leaveTo(this, 'MySky', data);
  }

  /* ---------------------------------------------------------------- *
   *  Panels
   * ---------------------------------------------------------------- */

  private fillPanel(w: number): void {
    this.panel.clear();

    const height = this.tab === 'tonight' ? this.fillTonight(w) : this.fillStargazers(w);

    this.panel.setContentHeight(height);
  }

  /** A centred line inside the panel, top-anchored at `y`. */
  private panelText(
    y: number,
    content: string,
    size: number,
    fill: string,
    options: { family?: string; italic?: boolean; wrap?: number } = {}
  ): GameObjects.Text {
    const text = crispText(this, this.panelWidth / 2, y, content, {
      fontFamily: options.family ?? font.sans,
      fontSize: `${size}px`,
      color: fill,
      align: 'center',
      ...(options.italic ? { fontStyle: 'italic' } : {}),
      ...(options.wrap ? { wordWrap: { width: options.wrap } } : {}),
    }).setOrigin(0.5, 0);
    this.panel.add(text);
    return text;
  }

  private divider(y: number, w: number): void {
    const line = this.add.graphics();
    line.lineStyle(1, color.line, 0.9);
    line.lineBetween(w * 0.15, y, w * 0.85, y);
    this.panel.add(line);
  }

  /* ---- Tonight ---- */

  private fillTonight(w: number): number {
    this.panelWidth = w;
    const jwala = this.jwala();
    const community = this.server?.community;

    const wrap = w - space.xl - space.xs;
    let y = space.xs;

    // The flame first — it is the thing to be proud of.
    const flame = crispText(this, w / 2, y, '🔥', { fontSize: `${typeScale.display}px` }).setOrigin(0.5, 0);
    this.panel.add(flame);
    y += flame.height + space.xs;

    const viewer = this.viewer();

    if (viewer === 'loading') {
      y += this.panelText(y, 'Counting your nights…', typeScale.body, ink.faint).height;
    } else if (viewer === 'anonymous') {
      // The invitation to act is the share pill below, outside the panel — a
      // ScrollPanel's content is deliberately deaf to taps (see ScrollPanel).
      y += this.panelText(y, 'Sign in to keep your Jwala burning', typeScale.body, ink.muted, { wrap }).height;
    } else {
      const count = crispText(this, w / 2, y, String(jwala.current), {
        fontFamily: font.serif,
        fontSize: `${typeScale.hero}px`,
        color: ink.accentDeep,
      }).setOrigin(0.5, 0);
      count.setShadow(0, 0, hex(color.accentGlow), glow.strong, true, true);
      this.panel.add(count);
      y += count.height;

      const caption = jwala.current === 1 ? 'night of Jwala' : 'nights of Jwala in a row';
      y += this.panelText(y, caption, typeScale.body, ink.muted).height;

      if (jwala.longest > jwala.current) {
        const longest = `Longest: ${plural(jwala.longest, 'night')}`;
        y += space.xs + this.panelText(y, longest, typeScale.caption, ink.faint).height;
      }
      // Signed in, but the night never reached Redis. Say so — the share card is
      // built from that record, so the player would otherwise learn it the hard way.
      if (!this.server?.tonight) {
        const unwritten = 'Tonight is not written down yet';
        y += space.xs + this.panelText(y, unwritten, typeScale.caption, ink.faint, { wrap }).height;
      }
    }

    y += space.md;
    const remaining = untilNextSky(this.nextNightAt - Date.now());
    this.countdown = this.panelText(y, remaining, typeScale.body, ink.accent);
    y += this.countdown.height + space.lg;

    this.divider(y, w);
    y += space.lg;

    if (community) {
      const stars =
        community.starsTonight > 0
          ? `${community.starsTonight.toLocaleString()} stars lit tonight`
          : 'You lit the first stars tonight';
      y += this.panelText(y, stars, typeScale.lead, ink.bright, { family: font.serif, wrap }).height;

      const by = `by ${plural(community.playersTonight, 'stargazer')}`;
      y += space.xs + this.panelText(y, by, typeScale.caption, ink.faint).height;
    } else {
      y += this.panelText(y, 'Counting tonight’s stars…', typeScale.body, ink.faint).height;
    }

    if (this.mySky && this.mySky.entries.length > 0) {
      const gathered = `${this.mySky.entries.length} of ${this.mySky.total} skies gathered`;
      y += space.xs + this.panelText(y, gathered, typeScale.caption, ink.muted).height;
    }

    y += space.lg;
    const summary = summariseNight(this.played(), this.server?.tonight ?? null);
    y += this.panelText(y, summary.headline, typeScale.caption, ink.muted, { wrap }).height;
    if (summary.note) {
      y += space.xs + this.panelText(y, summary.note, typeScale.caption, ink.faint, { wrap }).height;
    }

    return y + space.sm;
  }

  /* ---- Stargazers ---- */

  private fillStargazers(w: number): number {
    this.panelWidth = w;
    let y = space.xs;

    if (!this.boards) {
      this.panelText(y, 'Looking for tonight’s stargazers…', typeScale.body, ink.faint);
      return y + space.xxl;
    }

    y = this.board(y, w, 'Fastest tonight', this.boards.fastest, mmss, 'No one has raced tonight');
    y = this.board(
      y,
      w,
      'Fewest Whispers',
      this.boards.fewestWhispers,
      (value) => plural(value, 'Whisper'),
      'No one has finished tonight'
    );
    y = this.board(
      y,
      w,
      'Longest Jwala',
      this.boards.longestJwala,
      (value) => plural(value, 'night'),
      'No flames are burning yet'
    );

    return y + 4;
  }

  private board(
    y: number,
    w: number,
    title: string,
    rows: LeaderboardEntry[],
    format: (value: number) => string,
    empty: string
  ): number {
    const heading = this.panelText(y, title, typeScale.body, ink.accent, { family: font.serif });
    let cursor = y + heading.height + space.sm;

    if (rows.length === 0) {
      cursor += this.panelText(cursor, empty, typeScale.caption, ink.faint, { italic: true }).height;
      return cursor + space.lg;
    }

    const me = this.server?.username;
    for (const row of rows) {
      const mine = row.username === me;
      const fill = mine ? ink.accent : ink.muted;

      const rank = crispText(this, space.xs, cursor, String(row.rank), {
        fontFamily: font.sans,
        fontSize: `${typeScale.micro}px`,
        color: ink.faint,
      }).setOrigin(0, 0);

      const name = crispText(this, space.xl + space.xs, cursor, mine ? `${row.username} (you)` : row.username, {
        fontFamily: font.sans,
        fontSize: `${typeScale.caption}px`,
        color: fill,
      }).setOrigin(0, 0);

      // Kept clear of the right edge so a value never sits under the scrollbar.
      const value = crispText(this, w - space.md, cursor, format(row.value), {
        fontFamily: font.sans,
        fontSize: `${typeScale.caption}px`,
        color: fill,
      }).setOrigin(1, 0);

      this.panel.add(rank, name, value);
      cursor += name.height + space.sm;
    }

    return cursor + space.lg;
  }
}
