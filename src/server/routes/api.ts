/**
 * TaaraNight's API.
 *
 *   GET  /api/init          what the client needs to open the night
 *   POST /api/complete      record a solved night (once)
 *   GET  /api/mysky         the player's collected constellations
 *   GET  /api/leaderboards  tonight's soft boards
 *   POST /api/share         post tonight's spoiler-safe card as a comment
 *
 * Identity is the Reddit user, resolved server-side. Logged-out visitors can
 * play every night in full; their results simply are not written anywhere.
 */

import { Hono, type Context as HonoContext } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type {
  CompleteResponse,
  ErrorResponse,
  InitResponse,
  LeaderboardsResponse,
  MySkyResponse,
  ShareResponse,
} from '../../shared/api';
import { EMPTY_JWALA } from '../../shared/jwala';
import { millisUntilNextNight } from '../../shared/nightSeed';
import { buildShareText } from '../../shared/share';
import { currentNight, resolveNight } from '../core/night';
import { TOTAL_CONSTELLATIONS } from '../core/records';
import { store } from '../core/store';
import { validateCompleteRequest } from '../core/validate';

export const api = new Hono();

function fail(c: HonoContext, message: string): Response {
  return c.json<ErrorResponse>({ status: 'error', message }, 400);
}

api.get('/init', async (c) => {
  const night = currentNight();

  try {
    const username = (await reddit.getCurrentUsername()) ?? null;

    const [community, jwala, tonight] = await Promise.all([
      store.loadCommunity(night),
      username ? store.loadJwala(username) : Promise.resolve(EMPTY_JWALA),
      username ? store.loadResult(night, username) : Promise.resolve(null),
    ]);

    return c.json<InitResponse>({
      type: 'init',
      postId: context.postId ?? null,
      username,
      night,
      label: `TaaraNight #${night}`,
      msUntilNextNight: millisUntilNextNight(),
      tonight,
      jwala,
      community,
    });
  } catch (error) {
    console.error(`init failed for night ${night}:`, error);
    return fail(c, 'Could not open tonight’s sky');
  }
});

api.post('/complete', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 'Request body must be JSON');
  }

  const parsed = validateCompleteRequest(body);
  if (!parsed.ok) return fail(c, parsed.message);

  const request = parsed.value;
  const resolved = resolveNight(request.night);
  if (!resolved.ok) return fail(c, resolved.message);
  const night = resolved.night;

  try {
    const username = await reddit.getCurrentUsername();

    // Logged out: the night is still theirs to enjoy, it just isn't recorded.
    if (!username) {
      const community = await store.loadCommunity(night);
      return c.json<CompleteResponse>({
        type: 'complete',
        recorded: false,
        alreadyPlayed: false,
        result: {
          night,
          difficulty: request.difficulty,
          timeMs: request.timeMs,
          whispers: request.whispers,
          glitches: request.glitches,
          starsConnected: 0,
          completedAt: Date.now(),
        },
        jwala: EMPTY_JWALA,
        community,
        msUntilNextNight: millisUntilNextNight(),
      });
    }

    const outcome = await store.recordCompletion(username, night, request);

    return c.json<CompleteResponse>({
      type: 'complete',
      recorded: true,
      alreadyPlayed: outcome.alreadyPlayed,
      result: outcome.result,
      jwala: outcome.jwala,
      community: outcome.community,
      msUntilNextNight: millisUntilNextNight(),
    });
  } catch (error) {
    console.error(`complete failed for night ${night}:`, error);
    return fail(c, 'Could not record tonight’s sky');
  }
});

api.get('/mysky', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    const entries = username ? await store.loadMySky(username) : [];

    return c.json<MySkyResponse>({
      type: 'mySky',
      entries,
      total: TOTAL_CONSTELLATIONS,
    });
  } catch (error) {
    console.error('mysky failed:', error);
    return fail(c, 'Could not open My Sky');
  }
});

api.get('/leaderboards', async (c) => {
  const night = currentNight();

  try {
    const boards = await store.loadLeaderboards(night);
    return c.json<LeaderboardsResponse>({ type: 'leaderboards', night, ...boards });
  } catch (error) {
    console.error(`leaderboards failed for night ${night}:`, error);
    return fail(c, 'Could not read tonight’s stargazers');
  }
});

/**
 * Post tonight's share card as a comment on the nightly post, from the player's
 * own account.
 *
 * The body is composed here from the *stored* result, never from the request —
 * a client cannot put words in a player's mouth, and it cannot share a night it
 * did not actually reveal. One card per player per night.
 */
api.post('/share', async (c) => {
  const postId = context.postId;
  if (!postId) return fail(c, 'There is no post to share into');

  const night = currentNight();

  try {
    const username = await reddit.getCurrentUsername();
    if (!username) return fail(c, 'Sign in to share your night');

    const result = await store.loadResult(night, username);
    if (!result) return fail(c, 'Reveal tonight’s sky before sharing it');

    const posted = await store.loadShare(night, username);
    const jwala = await store.loadJwala(username);
    const text = buildShareText(result, jwala);

    if (posted) {
      return c.json<ShareResponse>({ type: 'share', alreadyShared: true, text, permalink: posted });
    }

    // `runAs: 'USER'` posts as the player rather than the app account, which is
    // what makes this a *share*. It needs permissions.reddit.asUser in devvit.json.
    const comment = await reddit.submitComment({ id: postId, text, runAs: 'USER' });
    await store.saveShare(night, username, comment.permalink);

    return c.json<ShareResponse>({
      type: 'share',
      alreadyShared: false,
      text,
      permalink: comment.permalink,
    });
  } catch (error) {
    console.error(`share failed for night ${night}:`, error);
    return fail(c, 'Could not post tonight’s card');
  }
});
