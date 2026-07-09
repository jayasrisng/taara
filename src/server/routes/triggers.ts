/**
 * App lifecycle triggers.
 *
 * Installing TaaraNight in a subreddit should leave a sky to play, so the app
 * opens tonight immediately rather than making the subreddit wait for 01:00 UTC.
 */

import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { currentNight } from '../core/night';
import { ensureNightlyPost } from '../core/post';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const night = currentNight();

  try {
    const post = await ensureNightlyPost(night);
    const input = await c.req.json<OnAppInstallRequest>();

    return c.json<TriggerResponse>(
      {
        status: 'success',
        message: post
          ? `Opened TaaraNight #${night} in r/${context.subredditName} as ${post.id} (trigger: ${input.type})`
          : `TaaraNight #${night} already has a post in r/${context.subredditName}`,
      },
      200
    );
  } catch (error) {
    console.error(`install post for night ${night} failed:`, error);
    return c.json<TriggerResponse>({ status: 'error', message: `Could not open night ${night}` }, 400);
  }
});
