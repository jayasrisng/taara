/**
 * Which night is it, according to the server?
 *
 * The client computes the same number for rendering, but the server never
 * trusts it — every write is recorded against the night resolved here.
 */

import { context } from '@devvit/web/server';
import { nightNumberAt } from '../../shared/nightSeed';

/** The playtest subreddit. Dev-only affordances unlock only here. */
const DEV_SUBREDDIT = 'taara_connect_dev';

/**
 * True inside the playtest subreddit. Used to gate the night override so a
 * streak can be tested in a minute instead of over three evenings.
 */
export function isDevSubreddit(): boolean {
  return context.subredditName?.toLowerCase() === DEV_SUBREDDIT;
}

/** Tonight's night number, clamped so a pre-launch clock still gets night 1. */
export function currentNight(now: number = Date.now()): number {
  return Math.max(1, nightNumberAt(now));
}

export type NightResolution = { ok: true; night: number } | { ok: false; message: string };

/**
 * The night a completion should be recorded against.
 *
 * An override is refused outright outside the dev subreddit rather than quietly
 * falling back to tonight — a silent fallback would let a stray request record
 * a completion nobody played.
 */
export function resolveNight(override: number | undefined): NightResolution {
  if (override === undefined) return { ok: true, night: currentNight() };
  if (!isDevSubreddit()) return { ok: false, message: 'night override is dev-only' };
  return { ok: true, night: override };
}
