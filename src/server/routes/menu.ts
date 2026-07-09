/**
 * Moderator menu actions.
 *
 * A *menu action* is an item Devvit adds to the subreddit's moderation menu;
 * tapping it POSTs the endpoint below and shows the response to the moderator.
 * This one is the manual escape hatch for the nightly cron: if a night ever
 * comes up postless, a mod can open it by hand.
 */

import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { currentNight } from '../core/night';
import { createNightlyPost, postUrl } from '../core/post';

export const menu = new Hono();

menu.post('/post-create', async (c) => {
  const night = currentNight();

  try {
    const post = await createNightlyPost(night);

    return c.json<UiResponse>(
      {
        navigateTo: postUrl(post),
        showToast: { text: `TaaraNight #${night} is open`, appearance: 'success' },
      },
      200
    );
  } catch (error) {
    console.error(`manual post for night ${night} failed:`, error);
    return c.json<UiResponse>({ showToast: `Could not open night ${night}` }, 400);
  }
});
