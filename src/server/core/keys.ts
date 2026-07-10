/**
 * Redis key design for TaaraNight.
 *
 * Devvit's Redis is already scoped to one app installation (one subreddit), so
 * these keys never need a subreddit segment. Everything is prefixed `tn:` so a
 * future feature can share the space without collisions.
 *
 *   tn:night:{n}:stars      int    stars connected by everyone on night n
 *   tn:night:{n}:players    int    players who finished night n
 *   tn:result:{n}:{user}    hash   that user's result for night n (write-once)
 *   tn:jwala:{user}         hash   { current, longest, lastNight }
 *   tn:sky:{user}           zset   member = constellationId, score = night
 *   tn:result:{n}:{user}:{d} hash  that user's result for night n on mode d
 *   tn:lb:{n}:night         zset   member = user, score = packed night score
 *   tn:lb:jwala             zset   member = user, score = current streak
 *   tn:share:{n}:{user}     str    permalink of that user's share comment
 *   tn:post:{postId}:night  str    the night that post plays, fixed at creation
 *   tn:night:{n}:post       str    the post created for night n, if any
 *
 * The result hash doubles as the repeat-play guard: if it exists, this user has
 * already finished this night and nothing may be counted again. The share key
 * plays the same role for comments — one card per player per night.
 *
 * The two post keys are the same edge read from both ends. `tn:post:…:night` is
 * what makes an old post keep playing its own sky forever; `tn:night:…:post`
 * lets the nightly cron notice that tonight already has a post and stay quiet.
 */

const PREFIX = 'tn';

export const keys = {
  nightStars: (night: number): string => `${PREFIX}:night:${night}:stars`,
  nightPlayers: (night: number): string => `${PREFIX}:night:${night}:players`,
  result: (night: number, username: string): string => `${PREFIX}:result:${night}:${username}`,
  jwala: (username: string): string => `${PREFIX}:jwala:${username}`,
  sky: (username: string): string => `${PREFIX}:sky:${username}`,
  resultDiff: (night: number, username: string, difficulty: string): string =>
    `${PREFIX}:result:${night}:${username}:${difficulty}`,
  lbNight: (night: number): string => `${PREFIX}:lb:${night}:night`,
  lbJwala: (): string => `${PREFIX}:lb:jwala`,
  share: (night: number, username: string): string => `${PREFIX}:share:${night}:${username}`,
  sharePost: (night: number, username: string): string =>
    `${PREFIX}:sharepost:${night}:${username}`,
  postNight: (postId: string): string => `${PREFIX}:post:${postId}:night`,
  nightPost: (night: number): string => `${PREFIX}:night:${night}:post`,
};

/**
 * The unified nightly board stores one number per player, so the whole ranking
 * is packed into it, most significant first: the mode (Hard beats Medium beats
 * Easy), then fewer Glitches, then less time, then fewer Whispers. Ascending
 * zset order *is* the leaderboard.
 *
 * Budget (all integer-safe, well under 2^53):
 *   rank    × 1e13   0 hard · 1 medium · 2 easy
 *   glitches× 1e10   capped 999
 *   timeMs  × 1e2    capped 9,999,999 ms (~2.8 h)
 *   whispers× 1      capped 99
 */
const RANKS = { hard: 0, medium: 1, easy: 2 } as const;
const RANK_NAMES = ['hard', 'medium', 'easy'] as const;

export interface NightScoreParts {
  difficulty: 'easy' | 'medium' | 'hard';
  glitches: number;
  timeMs: number;
  whispers: number;
}

export function nightScore(parts: NightScoreParts): number {
  const rank = RANKS[parts.difficulty];
  const glitches = Math.min(Math.max(parts.glitches, 0), 999);
  const timeMs = Math.min(Math.max(parts.timeMs, 0), 9_999_999);
  const whispers = Math.min(Math.max(parts.whispers, 0), 99);
  return rank * 1e13 + glitches * 1e10 + timeMs * 1e2 + whispers;
}

/** Unpack a board score back into the row it describes. */
export function nightScoreParts(score: number): NightScoreParts {
  const rank = Math.min(Math.floor(score / 1e13), 2);
  const glitches = Math.floor((score % 1e13) / 1e10);
  const timeMs = Math.floor((score % 1e10) / 1e2);
  const whispers = Math.floor(score % 1e2);
  return { difficulty: RANK_NAMES[rank]!, glitches, timeMs, whispers };
}
