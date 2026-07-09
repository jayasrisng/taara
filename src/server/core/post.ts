/**
 * Creating the nightly post.
 *
 * A post is born pinned to a night. That pin is the whole reason old posts keep
 * working: night #12's post opens night #12's sky forever, even a week later,
 * because the puzzle is derived from the night number rather than from the clock.
 *
 * The title names the night and nothing else — never the constellation. A post
 * title is the one piece of TaaraNight that appears unbidden in a feed, so it
 * has to stay spoiler-safe.
 */

import { reddit } from '@devvit/web/server';
import type { Post } from '@devvit/reddit';
import { store } from './store';

export function nightlyPostTitle(night: number): string {
  return `TaaraNight #${night} — tonight’s sky awaits 🌙`;
}

/** Where a post lives, as an absolute URL. */
export function postUrl(post: Post): string {
  return `https://www.reddit.com${post.permalink}`;
}

/** Create the post for a night and pin it to that night. */
export async function createNightlyPost(night: number): Promise<Post> {
  const post = await reddit.submitCustomPost({ title: nightlyPostTitle(night) });
  await store.savePostNight(post.id, night);
  return post;
}

/**
 * Create a night's post unless that night already has one. Returns null when
 * there was nothing to do.
 *
 * This is what the cron and the install trigger call. A moderator asking for a
 * post by hand gets `createNightlyPost` instead — if they are asking, they want
 * a post, even when one already exists.
 */
export async function ensureNightlyPost(night: number): Promise<Post | null> {
  const existing = await store.loadNightPost(night);
  if (existing) return null;
  return createNightlyPost(night);
}
