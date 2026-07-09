/**
 * The storage layer: results, Jwala streaks, My Sky, community stats and the
 * soft leaderboards. Key layout lives in keys.ts.
 *
 * Redis, in Devvit terms, is the app's own persistent key-value store, scoped
 * to the subreddit the app is installed in. It is the only storage TaaraNight
 * has — there is no external backend.
 *
 * This module takes its Redis client as an argument rather than importing the
 * live one, so the whole store can be driven by an in-memory fake in tests.
 * `store.ts` binds it to the real client; nothing else should.
 */

import type { RedisClient } from '@devvit/redis';
import type {
  CommunityStats,
  CompleteRequest,
  LeaderboardEntry,
  NightResult,
  SkyEntry,
} from '../../shared/api';
import type { Difficulty } from '../../shared/constellations';
import { CONSTELLATION_DATA } from '../../shared/constellationData';
import { advanceJwala, EMPTY_JWALA, type JwalaState } from '../../shared/jwala';
import { selectConstellationForNight } from '../../shared/puzzleEngine';
import { keys, whispersFromScore, whisperScore } from './keys';

/** Just the Redis surface TaaraNight actually uses. */
export type RedisLike = Pick<
  RedisClient,
  'get' | 'set' | 'mGet' | 'incrBy' | 'hGetAll' | 'hSet' | 'zAdd' | 'zRange'
>;

/** How many rows a soft leaderboard shows. Gentle, not exhaustive. */
const LEADERBOARD_SIZE = 10;

/** How many distinct constellations there are to collect. */
export const TOTAL_CONSTELLATIONS = CONSTELLATION_DATA.constellations.length;

function toInt(value: string | undefined | null, fallback = 0): number {
  if (value === undefined || value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDifficulty(value: string | undefined): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function rank(
  rows: { member: string; score: number }[],
  transform: (score: number) => number = (score) => score
): LeaderboardEntry[] {
  return rows.map((row, index) => ({
    username: row.member,
    value: transform(row.score),
    rank: index + 1,
  }));
}

export type RecordOutcome = {
  alreadyPlayed: boolean;
  result: NightResult;
  jwala: JwalaState;
  community: CommunityStats;
};

export type Leaderboards = {
  fastest: LeaderboardEntry[];
  fewestWhispers: LeaderboardEntry[];
  longestJwala: LeaderboardEntry[];
};

export function createStore(redis: RedisLike) {
  /* ---------------------------------------------------------------- *
   *  Jwala
   * ---------------------------------------------------------------- */

  async function loadJwala(username: string): Promise<JwalaState> {
    const hash = await redis.hGetAll(keys.jwala(username));
    if (!hash || Object.keys(hash).length === 0) return EMPTY_JWALA;
    return {
      current: toInt(hash.current),
      longest: toInt(hash.longest),
      lastNight: toInt(hash.lastNight),
    };
  }

  async function saveJwala(username: string, jwala: JwalaState): Promise<void> {
    await redis.hSet(keys.jwala(username), {
      current: String(jwala.current),
      longest: String(jwala.longest),
      lastNight: String(jwala.lastNight),
    });
    // The board tracks the flame currently burning, so a broken streak lowers
    // the score rather than leaving a stale high-water mark.
    await redis.zAdd(keys.lbJwala(), { member: username, score: jwala.current });
  }

  /* ---------------------------------------------------------------- *
   *  Results
   * ---------------------------------------------------------------- */

  /** A player's result for a night, or null if they have not finished it. */
  async function loadResult(night: number, username: string): Promise<NightResult | null> {
    const hash = await redis.hGetAll(keys.result(night, username));
    if (!hash || Object.keys(hash).length === 0) return null;

    const difficulty = hash.difficulty;
    if (!isDifficulty(difficulty)) return null;

    return {
      night,
      difficulty,
      timeMs: toInt(hash.timeMs),
      whispers: toInt(hash.whispers),
      glitches: toInt(hash.glitches),
      starsConnected: toInt(hash.starsConnected),
      completedAt: toInt(hash.completedAt),
    };
  }

  async function saveResult(username: string, result: NightResult): Promise<void> {
    await redis.hSet(keys.result(result.night, username), {
      difficulty: result.difficulty,
      timeMs: String(result.timeMs),
      whispers: String(result.whispers),
      glitches: String(result.glitches),
      starsConnected: String(result.starsConnected),
      completedAt: String(result.completedAt),
    });
  }

  /* ---------------------------------------------------------------- *
   *  Share cards
   * ---------------------------------------------------------------- */

  /** The permalink of this player's share comment for a night, if they posted one. */
  async function loadShare(night: number, username: string): Promise<string | null> {
    return (await redis.get(keys.share(night, username))) ?? null;
  }

  /** Remember that the card is posted, so a second tap cannot post a second comment. */
  async function saveShare(night: number, username: string, permalink: string): Promise<void> {
    await redis.set(keys.share(night, username), permalink);
  }

  /* ---------------------------------------------------------------- *
   *  Community / My Sky / leaderboards
   * ---------------------------------------------------------------- */

  async function loadCommunity(night: number): Promise<CommunityStats> {
    const [stars, players] = await redis.mGet([keys.nightStars(night), keys.nightPlayers(night)]);
    return { starsTonight: toInt(stars), playersTonight: toInt(players) };
  }

  /**
   * Every constellation this player has revealed, newest night first. Keyed by
   * constellation, so revealing one again after the no-repeat window refreshes
   * its night rather than adding a duplicate.
   */
  async function loadMySky(username: string): Promise<SkyEntry[]> {
    const rows = await redis.zRange(keys.sky(username), 0, -1, { by: 'rank' });
    return rows
      .map((row) => ({ constellationId: row.member, night: row.score }))
      .sort((a, b) => b.night - a.night);
  }

  async function loadLeaderboards(night: number): Promise<Leaderboards> {
    const top = LEADERBOARD_SIZE - 1;
    const [fastest, whispers, jwala] = await Promise.all([
      redis.zRange(keys.lbFastest(night), 0, top, { by: 'rank' }),
      redis.zRange(keys.lbWhispers(night), 0, top, { by: 'rank' }),
      redis.zRange(keys.lbJwala(), 0, top, { by: 'rank', reverse: true }),
    ]);

    return {
      fastest: rank(fastest),
      fewestWhispers: rank(whispers, whispersFromScore),
      longestJwala: rank(jwala),
    };
  }

  /* ---------------------------------------------------------------- *
   *  Recording a completion
   * ---------------------------------------------------------------- */

  /**
   * Record a completed night for a player, exactly once.
   *
   * The first completion of a night writes the result, feeds the Jwala, adds
   * the constellation to My Sky, bumps the community counters and files the
   * soft leaderboard entries. Any later completion of that same night — a
   * replay, a second difficulty, a double-tapped button — returns the original
   * result and changes nothing. The first solve of the night is the one that
   * counts.
   *
   * The constellation and its star count come from the night number, never from
   * the client, so a tampered request cannot collect a constellation it did not
   * actually reveal.
   */
  async function recordCompletion(
    username: string,
    night: number,
    request: CompleteRequest,
    now: number = Date.now()
  ): Promise<RecordOutcome> {
    const existing = await loadResult(night, username);
    if (existing) {
      const [jwala, community] = await Promise.all([loadJwala(username), loadCommunity(night)]);
      return { alreadyPlayed: true, result: existing, jwala, community };
    }

    const constellation = selectConstellationForNight(night);
    const result: NightResult = {
      night,
      difficulty: request.difficulty,
      timeMs: request.timeMs,
      whispers: request.whispers,
      glitches: request.glitches,
      starsConnected: constellation.stars.length,
      completedAt: now,
    };

    await saveResult(username, result);

    const jwala = advanceJwala(await loadJwala(username), night);
    await saveJwala(username, jwala);

    await redis.zAdd(keys.sky(username), { member: constellation.id, score: night });

    await Promise.all([
      redis.incrBy(keys.nightStars(night), result.starsConnected),
      redis.incrBy(keys.nightPlayers(night), 1),
    ]);

    // Fastest is a Hard-mode board only — an Easy solve with the outline
    // showing is not the same race. Whispers only rank where Whispers exist.
    if (result.difficulty === 'hard') {
      await redis.zAdd(keys.lbFastest(night), { member: username, score: result.timeMs });
    }
    if (result.difficulty !== 'easy') {
      await redis.zAdd(keys.lbWhispers(night), {
        member: username,
        score: whisperScore(result.whispers, result.timeMs),
      });
    }

    const community = await loadCommunity(night);
    return { alreadyPlayed: false, result, jwala, community };
  }

  return {
    loadJwala,
    loadResult,
    loadShare,
    saveShare,
    loadCommunity,
    loadMySky,
    loadLeaderboards,
    recordCompletion,
  };
}

export type Store = ReturnType<typeof createStore>;
