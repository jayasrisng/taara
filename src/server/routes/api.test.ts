/**
 * End-to-end route tests.
 *
 * `@devvit/web/server` is stubbed — an in-memory Redis, a switchable current
 * user, a switchable subreddit — so the real Hono handlers run start to finish
 * without a Devvit runtime. This covers the things unit tests cannot: routing,
 * status codes, the JSON shapes the client depends on, the spoiler rule, and
 * the dev-only gate on the night override.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONSTELLATION_DATA } from '../../shared/constellationData';
import { createFakeRedis } from '../core/fakeRedis';
import { keys } from '../core/keys';

type SubmittedComment = { id: string; text: string; runAs?: string };

const live = {
  redis: createFakeRedis(),
  username: 'ana' as string | undefined,
  subredditName: 'taara_connect_dev',
  postId: 't3_abc' as string | undefined,
  comments: [] as SubmittedComment[],
};

vi.mock('@devvit/web/server', () => ({
  // Delegate so each test can swap in a fresh fake.
  redis: {
    get: (...a: Parameters<typeof live.redis.get>) => live.redis.get(...a),
    set: (...a: Parameters<typeof live.redis.set>) => live.redis.set(...a),
    mGet: (...a: Parameters<typeof live.redis.mGet>) => live.redis.mGet(...a),
    incrBy: (...a: Parameters<typeof live.redis.incrBy>) => live.redis.incrBy(...a),
    hGetAll: (...a: Parameters<typeof live.redis.hGetAll>) => live.redis.hGetAll(...a),
    hSet: (...a: Parameters<typeof live.redis.hSet>) => live.redis.hSet(...a),
    zAdd: (...a: Parameters<typeof live.redis.zAdd>) => live.redis.zAdd(...a),
    zRange: (...a: Parameters<typeof live.redis.zRange>) => live.redis.zRange(...a),
  },
  reddit: {
    getCurrentUsername: async () => live.username,
    submitComment: async (comment: SubmittedComment) => {
      live.comments.push(comment);
      return { id: `t1_${live.comments.length}`, permalink: `/r/x/comments/abc/_/c${live.comments.length}/` };
    },
  },
  context: {
    get postId() {
      return live.postId;
    },
    get subredditName() {
      return live.subredditName;
    },
  },
}));

const { api } = await import('./api');

const post = (body: unknown) =>
  api.request('/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const share = () => api.request('/share', { method: 'POST' });

const solve = { difficulty: 'hard', timeMs: 42_000, whispers: 1, glitches: 2 };

describe('routes', () => {
  beforeEach(() => {
    live.redis = createFakeRedis();
    live.username = 'ana';
    live.subredditName = 'taara_connect_dev';
    live.postId = 't3_abc';
    live.comments = [];
  });

  it('GET /init returns tonight', async () => {
    const res = await api.request('/init');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe('init');
    expect(body.username).toBe('ana');
    expect(body.night).toBeGreaterThan(0);
    expect(body.label).toBe(`TaaraNight #${body.night}`);
    expect(body.msUntilNextNight).toBeGreaterThan(0);
    expect(body.postId).toBe('t3_abc');
    expect(body.tonight).toBeNull();
  });

  it('never leaks a constellation name or story', async () => {
    const payload = JSON.stringify(await (await api.request('/init')).json());
    for (const c of CONSTELLATION_DATA.constellations) {
      expect(payload).not.toContain(c.name);
      expect(payload).not.toContain(c.story.slice(0, 24));
    }
  });

  it('POST /complete records once, then reports alreadyPlayed', async () => {
    const first = await (await post(solve)).json();
    expect(first.recorded).toBe(true);
    expect(first.alreadyPlayed).toBe(false);
    expect(first.jwala.current).toBe(1);
    expect(first.community.playersTonight).toBe(1);

    const second = await (await post({ ...solve, timeMs: 1 })).json();
    expect(second.alreadyPlayed).toBe(true);
    expect(second.result.timeMs).toBe(42_000);
    expect(second.community.playersTonight).toBe(1);
  });

  it('GET /init then reflects the stored result', async () => {
    await post(solve);
    const body = await (await api.request('/init')).json();
    expect(body.tonight.timeMs).toBe(42_000);
    expect(body.jwala.current).toBe(1);
  });

  it('POST /complete rejects bad payloads with 400', async () => {
    expect((await post({ ...solve, difficulty: 'nightmare' })).status).toBe(400);
    expect((await post({ ...solve, whispers: 9 })).status).toBe(400);
    expect((await post({ ...solve, timeMs: -5 })).status).toBe(400);
    const res = await api.request('/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });

  it('honours the night override in the dev subreddit', async () => {
    const init = await (await api.request('/init')).json();
    const yesterday = await (await post({ ...solve, night: init.night - 1 })).json();
    expect(yesterday.recorded).toBe(true);
    expect(yesterday.jwala.current).toBe(1);

    const tonight = await (await post(solve)).json();
    expect(tonight.jwala.current).toBe(2);
    expect(tonight.jwala.lastNight).toBe(init.night);
  });

  it('refuses the night override outside the dev subreddit', async () => {
    live.subredditName = 'TaaraNight';
    const res = await post({ ...solve, night: 3 });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/dev-only/);
  });

  it('plays but does not record for logged-out visitors', async () => {
    live.username = undefined;
    const body = await (await post(solve)).json();
    expect(body.recorded).toBe(false);
    expect(body.jwala.current).toBe(0);

    const mysky = await (await api.request('/mysky')).json();
    expect(mysky.entries).toEqual([]);
    expect(mysky.total).toBeGreaterThan(15);
  });

  /**
   * Regression, Step 7.5. Fastest is a Hard-mode board: an Easy solve with the
   * outline showing is not the same race. Playing Easy — even in sixteen
   * seconds, even after a Hard solve is on file — must never put a time on it.
   */
  it('POST /complete on Easy never files a Fastest time', async () => {
    await post({ difficulty: 'easy', timeMs: 16_000, whispers: 0, glitches: 0 });

    const boards = await (await api.request('/leaderboards')).json();
    expect(boards.fastest).toEqual([]);

    // The Hard replay is not recorded either — the night already has a record.
    await post({ difficulty: 'hard', timeMs: 16_000, whispers: 0, glitches: 0 });
    expect((await (await api.request('/leaderboards')).json()).fastest).toEqual([]);
  });

  /**
   * Regression, Step 7.5. The stored record is write-once, so after Hard then
   * Easy it still describes the Hard solve. That is correct — but it is the
   * *record*, not the solve just played, and the results screen must not read
   * it as one. See client/ui/nightSummary.test.ts for the other half.
   */
  it('POST /complete echoes the recorded solve, not the one just replayed', async () => {
    await post({ difficulty: 'hard', timeMs: 16_000, whispers: 0, glitches: 0 });
    const replay = await (await post({ difficulty: 'easy', timeMs: 90_000, whispers: 0, glitches: 0 })).json();

    expect(replay.alreadyPlayed).toBe(true);
    expect(replay.result.difficulty).toBe('hard');
    expect((await (await api.request('/init')).json()).tonight.difficulty).toBe('hard');
  });

  it('GET /mysky and /leaderboards reflect a play', async () => {
    await post(solve);

    const mysky = await (await api.request('/mysky')).json();
    expect(mysky.entries).toHaveLength(1);
    expect(mysky.entries[0].constellationId).toBeTruthy();

    const boards = await (await api.request('/leaderboards')).json();
    expect(boards.fastest).toEqual([{ username: 'ana', value: 42_000, rank: 1 }]);
    expect(boards.fewestWhispers).toEqual([{ username: 'ana', value: 1, rank: 1 }]);
    expect(boards.longestJwala).toEqual([{ username: 'ana', value: 1, rank: 1 }]);
  });
});

/**
 * An old post keeps its own sky. Everything the routes say — the night, the
 * community count, the boards, the recorded result — must be about the night
 * the post was pinned to, not about tonight.
 */
describe('an archive post', () => {
  const ARCHIVE_NIGHT = 4;

  beforeEach(async () => {
    live.redis = createFakeRedis();
    live.username = 'ana';
    live.subredditName = 'taara_connect_dev';
    live.postId = 't3_old';
    live.comments = [];
    await live.redis.set(keys.postNight('t3_old'), String(ARCHIVE_NIGHT));
  });

  it('GET /init opens the night the post was pinned to', async () => {
    const body = await (await api.request('/init')).json();
    expect(body.night).toBe(ARCHIVE_NIGHT);
    expect(body.label).toBe(`TaaraNight #${ARCHIVE_NIGHT}`);
  });

  it('records the completion against the post’s night', async () => {
    const body = await (await post(solve)).json();
    expect(body.recorded).toBe(true);
    expect(body.result.night).toBe(ARCHIVE_NIGHT);
  });

  it('shows that night’s stargazers, not tonight’s', async () => {
    await post(solve);

    const boards = await (await api.request('/leaderboards')).json();
    expect(boards.night).toBe(ARCHIVE_NIGHT);
    expect(boards.fastest).toEqual([{ username: 'ana', value: 42_000, rank: 1 }]);

    live.postId = 't3_tonight';
    const tonight = await (await api.request('/leaderboards')).json();
    expect(tonight.night).not.toBe(ARCHIVE_NIGHT);
    expect(tonight.fastest).toEqual([]);
  });

  it('shares that night’s card', async () => {
    await post(solve);
    const body = await (await share()).json();
    expect(body.text).toContain(`TaaraNight #${ARCHIVE_NIGHT}`);
  });

  it('falls back to tonight for a post that was never pinned', async () => {
    live.postId = 't3_before_step_7';
    const body = await (await api.request('/init')).json();
    expect(body.night).toBeGreaterThan(ARCHIVE_NIGHT);
  });
});

describe('POST /share', () => {
  beforeEach(() => {
    live.redis = createFakeRedis();
    live.username = 'ana';
    live.subredditName = 'taara_connect_dev';
    live.postId = 't3_abc';
    live.comments = [];
  });

  it('comments the card on the post, as the player', async () => {
    await post(solve);

    const res = await share();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyShared).toBe(false);
    expect(body.permalink).toBeTruthy();

    expect(live.comments).toHaveLength(1);
    expect(live.comments[0]).toMatchObject({ id: 't3_abc', runAs: 'USER' });
    expect(live.comments[0]!.text).toBe(body.text);
    expect(body.text).toContain('Jwala streak: 1 night');
    expect(body.text).toContain('1 Whisper used');
  });

  it('never spoils the constellation in the comment', async () => {
    await post(solve);
    const body = await (await share()).json();
    for (const c of CONSTELLATION_DATA.constellations) {
      expect(body.text).not.toContain(c.name);
      expect(body.text).not.toContain(c.story.slice(0, 24));
    }
  });

  it('posts one card per night, however many times it is asked', async () => {
    await post(solve);
    const first = await (await share()).json();
    const second = await (await share()).json();

    expect(second.alreadyShared).toBe(true);
    expect(second.permalink).toBe(first.permalink);
    expect(live.comments).toHaveLength(1);
  });

  it('refuses to share a night the player has not revealed', async () => {
    const res = await share();
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/Reveal tonight/);
    expect(live.comments).toEqual([]);
  });

  it('refuses when logged out', async () => {
    live.username = undefined;
    expect((await share()).status).toBe(400);
    expect(live.comments).toEqual([]);
  });

  it('refuses when there is no post to comment on', async () => {
    await post(solve);
    live.postId = undefined;
    expect((await share()).status).toBe(400);
    expect(live.comments).toEqual([]);
  });
});
