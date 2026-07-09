/**
 * Which night is it, according to the server?
 *
 * Two different questions live here. *Tonight* is a clock reading. *This post's
 * night* is a fact recorded when the post was created — an archive post opens
 * the sky it was born under, however long ago that was. Routes almost always
 * want the second one.
 *
 * The client computes tonight for itself so the menu paints instantly, but the
 * server never trusts it: every write is recorded against the night resolved here.
 */

import { context } from '@devvit/web/server';
import { nightNumberAt } from '../../shared/nightSeed';
import { store } from './store';

/** The playtest subreddit. Dev-only affordances unlock only here. */
const DEV_SUBREDDIT = 'taara_connect_dev';

/**
 * How early the nightly cron may fire and still mean the night it is opening.
 * A job that lands a few seconds before 01:00 UTC is opening tomorrow's sky,
 * not re-opening today's.
 */
const CRON_SKEW_MS = 60_000;

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

/**
 * The night the nightly cron is opening. Nudged forward by the skew window so
 * an early fire still creates the post for the night that is about to begin.
 */
export function scheduledNight(now: number = Date.now()): number {
  return currentNight(now + CRON_SKEW_MS);
}

/**
 * The night the post this request came from plays.
 *
 * Falls back to tonight when there is no post (a menu action) or when the post
 * predates the mapping — those were all created as "tonight" anyway.
 */
export async function postNight(): Promise<number> {
  const postId = context.postId;
  if (!postId) return currentNight();
  return (await store.loadPostNight(postId)) ?? currentNight();
}

export type NightResolution = { ok: true; night: number } | { ok: false; message: string };

/**
 * The night a completion should be recorded against.
 *
 * An override is refused outright outside the dev subreddit rather than quietly
 * falling back to the post's night — a silent fallback would let a stray request
 * record a completion nobody played.
 */
export async function resolveNight(override: number | undefined): Promise<NightResolution> {
  if (override === undefined) return { ok: true, night: await postNight() };
  if (!isDevSubreddit()) return { ok: false, message: 'night override is dev-only' };
  return { ok: true, night: override };
}
