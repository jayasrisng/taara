/**
 * The nightly post, made by the clock.
 *
 * Devvit's *scheduler* runs an endpoint of ours on a cron schedule, on Reddit's
 * servers, with no browser open. `devvit.json` maps the cron `0 1 * * *` to the
 * route below, so every night at 01:00 UTC — the same boundary the puzzle turns
 * on — the new sky gets a post of its own.
 */

import { Hono } from 'hono';
import { scheduledNight } from '../core/night';
import { ensureNightlyPost } from '../core/post';

/** Scheduled endpoints are POSTed JSON and must answer with JSON. */
type TaskResult = { status: 'success' | 'error'; message: string };

export const scheduler = new Hono();

scheduler.post('/nightly-post', async (c) => {
  const night = scheduledNight();

  try {
    const post = await ensureNightlyPost(night);

    return c.json<TaskResult>(
      {
        status: 'success',
        message: post
          ? `Opened TaaraNight #${night} with post ${post.id}`
          : `TaaraNight #${night} already has a post`,
      },
      200
    );
  } catch (error) {
    console.error(`nightly post for night ${night} failed:`, error);
    return c.json<TaskResult>({ status: 'error', message: `Could not open night ${night}` }, 500);
  }
});
