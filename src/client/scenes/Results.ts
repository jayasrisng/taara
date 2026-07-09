/**
 * Results — the quiet room after the story.
 *
 * Three tabs, in the order they matter at bedtime: **Tonight** (your Jwala, the
 * countdown to the next sky, what the community lit together), **My Sky** (the
 * constellations you have gathered), and **Stargazers** (the soft leaderboards,
 * deliberately last and deliberately small).
 *
 * The screen paints from what the Play scene already knew, then quietly
 * reconciles with the server. Nothing here ever waits on the network to appear.
 *
 * The share button asks the server to comment tonight's card on the post. The
 * card is spoiler-safe: it never names the constellation, only the night, the
 * player's own effort, and a mood.
 */

import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import { showLoginPrompt, showToast } from '@devvit/web/client';
import type {
  CompleteResponse,
  InitResponse,
  LeaderboardEntry,
  LeaderboardsResponse,
  MySkyResponse,
  NightResult,
} from '../../shared/api';
import type { Constellation, Difficulty } from '../../shared/constellations';
import { getConstellationById } from '../../shared/constellationLoader';
import { EMPTY_JWALA, type JwalaState } from '../../shared/jwala';
import { millisUntilNextNight } from '../../shared/nightSeed';
import { fetchInit, fetchLeaderboards, fetchMySky, postShare } from '../api';
import { NightSky } from '../ui/NightSky';
import { untilNextSky } from '../ui/countdown';
import { crispText } from '../ui/display';
import { clamp, onLayout, type Viewport } from '../ui/layout';
import { mmss, plural, summariseNight } from '../ui/nightSummary';
import { Pill } from '../ui/Pill';
import { ScrollPanel } from '../ui/ScrollPanel';

const COLORS = {
  text: '#f5f3ff',
  muted: '#a7b0da',
  faint: '#7883b0',
  accent: '#ffe3a3',
  flame: '#ffb86b',
  line: 0x2b3268,
  cell: 0x161c40,
  cellTonight: 0x1f2650,
  star: 0xfff6e0,
  edge: 0xffd27f,
  accentLine: 0xffe3a3,
};

const SHARE_LABEL = '🌙  Share tonight';
const SIGN_IN_LABEL = 'Sign in to share';

const TABS = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'sky', label: 'My Sky' },
  { id: 'stargazers', label: 'Stargazers' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Below this width the tab labels tighten. */
const NARROW_W = 380;

/** What a My Sky thumbnail wants to be. Columns are chosen to get close to it. */
const CELL_TARGET_W = 165;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;
/** Below this height the subtitle under the night number is the first thing to go. */
const DENSE_H = 560;

const TAB_H = 38;
const SHARE_H = 44;

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
};

export class Results extends Scene {
  private params!: ResultsData;

  private sky!: NightSky;
  private panel!: ScrollPanel;
  private ui: GameObjects.GameObject[] = [];
  private pills: Pill[] = [];
  private view: Viewport = { w: 0, h: 0 };

  private tab: TabId = 'tonight';

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
    this.tab = 'tonight';
    this.server = null;
    this.mySky = null;
    this.boards = null;
    this.boardsRequested = false;
    this.countdown = null;
    this.sharePill = null;
    this.sharing = false;
    this.shared = false;
    this.nextNightAt = Date.now() + millisUntilNextNight();
  }

  create(): void {
    this.sky = new NightSky(this, this.params.night);
    this.panel = new ScrollPanel(this);

    onLayout(this, (view) => this.build(view));

    this.time.addEvent({ delay: 250, loop: true, callback: () => this.tickCountdown() });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.panel.destroy());

    void this.sync();
    this.cameras.main.fadeIn(400, 5, 6, 15);
    this.panel.fadeIn(400, 5, 6, 15);
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
    if (this.tab === 'stargazers') this.relayout();
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
    this.countdown = null;
    this.sharePill = null;

    const sidePad = clamp(14, w * 0.05, 32);
    const narrow = w < NARROW_W;
    const dense = h < DENSE_H;
    const contentW = w - sidePad * 2;

    /* ---- header, flowing down ---- */

    let top = clamp(10, h * 0.035, 30);

    const title = crispText(this, w / 2, top, `TaaraNight #${this.params.night}`, {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: `${clamp(22, Math.min(w * 0.085, h * 0.05), 32)}px`,
      color: COLORS.text,
    }).setOrigin(0.5, 0);
    title.setShadow(0, 0, '#8aa0ff', 14, true, true);
    this.ui.push(title);
    top += title.height;

    if (!dense) {
      const subtitle = crispText(this, w / 2, top + 4, 'Tonight’s sky revealed', {
        fontFamily: 'Georgia, serif',
        fontSize: '15px',
        color: COLORS.muted,
        fontStyle: 'italic',
      }).setOrigin(0.5, 0);
      this.ui.push(subtitle);
      top = subtitle.y + subtitle.height;
    }

    /* ---- tabs ---- */

    top += clamp(10, h * 0.022, 18);
    const tabGap = 8;
    const tabW = (contentW - tabGap * (TABS.length - 1)) / TABS.length;

    TABS.forEach((tab, i) => {
      const pill = new Pill(
        this,
        tab.label,
        { height: TAB_H, minWidth: tabW, fontSize: narrow ? 13 : 14, paddingX: 8 },
        () => this.selectTab(tab.id)
      );
      pill.setActive(tab.id === this.tab);
      pill.setPosition(sidePad + tabW / 2 + i * (tabW + tabGap), top + TAB_H / 2);
      this.pills.push(pill);
    });
    top += TAB_H;

    /* ---- share row, flowing up ---- */

    let bottom = h - clamp(10, h * 0.03, 24);

    const back = crispText(this, w / 2, bottom, 'Return to the sky', {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: COLORS.faint,
    }).setOrigin(0.5, 1);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('MainMenu'));
    this.ui.push(back);
    bottom -= back.height + 12;

    // A signed-out player cannot comment, so the button asks for the one thing
    // that would let them — rather than offering a share that will be refused.
    const anonymous = this.viewer() === 'anonymous';
    const share = new Pill(
      this,
      anonymous ? SIGN_IN_LABEL : this.shared ? '✓ Shared' : SHARE_LABEL,
      { height: SHARE_H, minWidth: Math.min(contentW, 280), fontSize: 15 },
      () => (anonymous ? showLoginPrompt() : void this.share())
    );
    share.setPosition(w / 2, bottom - SHARE_H / 2);
    share.setEnabled(anonymous || (this.viewer() === 'known' && !this.shared && !this.sharing));
    this.sharePill = share;
    this.pills.push(share);
    bottom -= SHARE_H + 10;

    /* ---- the panel takes what is left ---- */

    const panelTop = top + clamp(8, h * 0.02, 16);
    const panelH = Math.max(80, bottom - panelTop);
    this.panel.setBounds(sidePad, panelTop, contentW, panelH);
    this.fillPanel(contentW);
  }

  private selectTab(tab: TabId): void {
    if (this.tab === tab) return;
    this.tab = tab;
    if (tab === 'stargazers') void this.loadBoards();
    this.relayout();
  }

  /* ---------------------------------------------------------------- *
   *  Panels
   * ---------------------------------------------------------------- */

  private fillPanel(w: number): void {
    this.panel.clear();

    let height: number;
    if (this.tab === 'tonight') height = this.fillTonight(w);
    else if (this.tab === 'sky') height = this.fillMySky(w);
    else height = this.fillStargazers(w);

    this.panel.setContentHeight(height);
  }

  /** A centred line inside the panel, top-anchored at `y`. */
  private panelText(
    y: number,
    content: string,
    size: number,
    color: string,
    options: { family?: string; italic?: boolean; wrap?: number } = {}
  ): GameObjects.Text {
    const text = crispText(this, this.panelWidth / 2, y, content, {
      fontFamily: options.family ?? 'Arial',
      fontSize: `${size}px`,
      color,
      align: 'center',
      ...(options.italic ? { fontStyle: 'italic' } : {}),
      ...(options.wrap ? { wordWrap: { width: options.wrap } } : {}),
    }).setOrigin(0.5, 0);
    this.panel.add(text);
    return text;
  }

  private divider(y: number, w: number): void {
    const line = this.add.graphics();
    line.lineStyle(1, COLORS.line, 0.9);
    line.lineBetween(w * 0.15, y, w * 0.85, y);
    this.panel.add(line);
  }

  /* ---- Tonight ---- */

  private fillTonight(w: number): number {
    this.panelWidth = w;
    const jwala = this.jwala();
    const community = this.server?.community;

    let y = 6;

    // The flame first — it is the thing to be proud of.
    const flame = crispText(this, w / 2, y, '🔥', { fontSize: '32px' }).setOrigin(0.5, 0);
    this.panel.add(flame);
    y += flame.height + 2;

    const viewer = this.viewer();

    if (viewer === 'loading') {
      y += this.panelText(y, 'Counting your nights…', 14, COLORS.faint).height;
    } else if (viewer === 'anonymous') {
      // The invitation to act is the share pill below, outside the panel — a
      // ScrollPanel's content is deliberately deaf to taps (see ScrollPanel).
      y += this.panelText(y, 'Sign in to keep your Jwala burning', 14, COLORS.muted, { wrap: w - 20 }).height;
    } else {
      const count = crispText(this, w / 2, y, String(jwala.current), {
        fontFamily: 'Georgia, serif',
        fontSize: '40px',
        color: COLORS.flame,
      }).setOrigin(0.5, 0);
      count.setShadow(0, 0, '#ff9d4d', 18, true, true);
      this.panel.add(count);
      y += count.height;

      const caption = jwala.current === 1 ? 'night of Jwala' : 'nights of Jwala in a row';
      y += this.panelText(y, caption, 14, COLORS.muted).height;

      if (jwala.longest > jwala.current) {
        y += 2 + this.panelText(y, `Longest: ${plural(jwala.longest, 'night')}`, 12, COLORS.faint).height;
      }
      // Signed in, but the night never reached Redis. Say so — the share card is
      // built from that record, so the player would otherwise learn it the hard way.
      if (!this.server?.tonight) {
        y += 6 + this.panelText(y, 'Tonight is not written down yet', 12, COLORS.faint, { wrap: w - 20 }).height;
      }
    }

    y += 14;
    this.countdown = this.panelText(y, untilNextSky(this.nextNightAt - Date.now()), 15, COLORS.accent);
    y += this.countdown.height + 16;

    this.divider(y, w);
    y += 16;

    if (community) {
      const stars =
        community.starsTonight > 0
          ? `${community.starsTonight.toLocaleString()} stars lit tonight`
          : 'You lit the first stars tonight';
      y += this.panelText(y, stars, 16, COLORS.text, { family: 'Georgia, serif', wrap: w - 20 }).height;
      y += 4 + this.panelText(y, `by ${plural(community.playersTonight, 'stargazer')}`, 13, COLORS.faint).height;
    } else {
      y += this.panelText(y, 'Counting tonight’s stars…', 14, COLORS.faint).height;
    }

    y += 16;
    const summary = summariseNight(this.played(), this.server?.tonight ?? null);
    y += this.panelText(y, summary.headline, 13, COLORS.muted, { wrap: w - 20 }).height;
    if (summary.note) {
      y += 4 + this.panelText(y, summary.note, 12, COLORS.faint, { wrap: w - 20 }).height;
    }

    return y + 8;
  }

  /* ---- My Sky ---- */

  private fillMySky(w: number): number {
    this.panelWidth = w;
    let y = 4;

    if (!this.mySky) {
      this.panelText(y, 'Opening your sky…', 14, COLORS.faint);
      return y + 30;
    }

    const entries = this.mySky.entries;

    if (entries.length === 0) {
      y += this.panelText(y, 'Your sky is still dark', 17, COLORS.text, { family: 'Georgia, serif' }).height;
      const hint =
        this.viewer() === 'known'
          ? 'Every constellation you reveal is kept here, night after night.'
          : 'Sign in, and every constellation you reveal is kept here.';
      y += 8 + this.panelText(y, hint, 13, COLORS.faint, { wrap: Math.min(w - 30, 300) }).height;
      return y + 8;
    }

    y += this.panelText(y, `${entries.length} of ${this.mySky.total} skies gathered`, 14, COLORS.muted).height;
    y += 14;

    // Enough columns to keep a thumbnail near its target size — two on a phone,
    // five on a desktop — rather than three enormous cells on a wide screen.
    const columns = clamp(MIN_COLUMNS, Math.floor(w / CELL_TARGET_W), MAX_COLUMNS);
    const gap = 10;
    const cellW = (w - gap * (columns - 1)) / columns;
    const cellH = cellW * 0.95;

    let drawn = 0;
    for (const entry of entries) {
      const constellation = getConstellationById(entry.constellationId);
      if (!constellation) continue;

      const col = drawn % columns;
      const row = Math.floor(drawn / columns);
      const tonight = entry.constellationId === this.params.constellationId;
      const cell = this.skyCell(
        col * (cellW + gap),
        y + row * (cellH + gap),
        cellW,
        cellH,
        constellation,
        entry.night,
        tonight
      );
      this.panel.add(cell);
      drawn++;
    }

    const rows = Math.ceil(drawn / columns);
    return y + rows * (cellH + gap) + 4;
  }

  /** One gathered constellation: its shape, its name, the night it was revealed. */
  private skyCell(
    x: number,
    y: number,
    w: number,
    h: number,
    constellation: Constellation,
    night: number,
    tonight: boolean
  ): GameObjects.Container {
    const bg = this.add.graphics();
    bg.fillStyle(tonight ? COLORS.cellTonight : COLORS.cell, 0.88);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(tonight ? 1.5 : 1, tonight ? COLORS.accentLine : COLORS.line, tonight ? 0.7 : 0.9);
    bg.strokeRoundedRect(0, 0, w, h, 12);

    const art = this.thumbnail(constellation, w, h - 32);

    const name = crispText(this, w / 2, h - 15, constellation.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: COLORS.accent,
      align: 'center',
    }).setOrigin(0.5, 1);

    const label = crispText(this, w / 2, h - 4, tonight ? `#${night} · tonight` : `#${night}`, {
      fontFamily: 'Arial',
      fontSize: '9px',
      color: COLORS.faint,
    }).setOrigin(0.5, 1);

    return this.add.container(x, y, [bg, art, name, label]);
  }

  /**
   * A miniature of the constellation, scaled to fit the cell without distorting
   * its shape — the point of My Sky is recognising the thing you drew.
   */
  private thumbnail(constellation: Constellation, w: number, h: number): GameObjects.Graphics {
    const gfx = this.add.graphics();
    const pad = 12;
    const box = Math.max(10, Math.min(w - pad * 2, h - pad * 2));
    const ox = (w - box) / 2;
    const oy = (h - box) / 2;

    const at = (index: number): { x: number; y: number } => {
      const star = constellation.stars[index]!;
      return { x: ox + star.x * box, y: oy + star.y * box };
    };

    gfx.lineStyle(1.5, COLORS.edge, 0.75);
    for (const edge of constellation.connections) {
      const a = at(edge.from);
      const b = at(edge.to);
      gfx.lineBetween(a.x, a.y, b.x, b.y);
    }

    gfx.fillStyle(COLORS.star, 1);
    for (let i = 0; i < constellation.stars.length; i++) {
      const point = at(i);
      gfx.fillCircle(point.x, point.y, 2);
    }

    return gfx;
  }

  /* ---- Stargazers ---- */

  private fillStargazers(w: number): number {
    this.panelWidth = w;
    let y = 4;

    if (!this.boards) {
      this.panelText(y, 'Looking for tonight’s stargazers…', 14, COLORS.faint);
      return y + 30;
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
    let cursor = y + this.panelText(y, title, 14, COLORS.accent, { family: 'Georgia, serif' }).height + 8;

    if (rows.length === 0) {
      cursor += this.panelText(cursor, empty, 12, COLORS.faint, { italic: true }).height;
      return cursor + 18;
    }

    const me = this.server?.username;
    for (const row of rows) {
      const mine = row.username === me;
      const color = mine ? COLORS.accent : COLORS.muted;

      const rank = crispText(this, 4, cursor, String(row.rank), {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: COLORS.faint,
      }).setOrigin(0, 0);

      const name = crispText(this, 28, cursor, mine ? `${row.username} (you)` : row.username, {
        fontFamily: 'Arial',
        fontSize: '13px',
        color,
      }).setOrigin(0, 0);

      // Kept clear of the right edge so a value never sits under the scrollbar.
      const value = crispText(this, w - 12, cursor, format(row.value), {
        fontFamily: 'Arial',
        fontSize: '13px',
        color,
      }).setOrigin(1, 0);

      this.panel.add(rank, name, value);
      cursor += name.height + 7;
    }

    return cursor + 18;
  }
}
