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
 *   tn:lb:{n}:fastest       zset   member = user, score = timeMs        (Hard)
 *   tn:lb:{n}:whispers      zset   member = user, score = composite  (Med+Hard)
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
  lbFastest: (night: number): string => `${PREFIX}:lb:${night}:fastest`,
  lbWhispers: (night: number): string => `${PREFIX}:lb:${night}:whispers`,
  lbJwala: (): string => `${PREFIX}:lb:jwala`,
  share: (night: number, username: string): string => `${PREFIX}:share:${night}:${username}`,
  postNight: (postId: string): string => `${PREFIX}:post:${postId}:night`,
  nightPost: (night: number): string => `${PREFIX}:night:${night}:post`,
};

/**
 * A sorted set stores one score, but "fewest Whispers" needs a tiebreak or the
 * board is an arbitrary pile of zeroes. We pack Whispers into the high digits
 * and the solve time into the low ones, so the natural ascending order reads
 * "fewest Whispers, then fastest".
 */
const WHISPER_SCALE = 1_000_000;
const MAX_TIEBREAK_MS = WHISPER_SCALE - 1;

export function whisperScore(whispers: number, timeMs: number): number {
  return whispers * WHISPER_SCALE + Math.min(timeMs, MAX_TIEBREAK_MS);
}

/** Recover the displayable Whisper count from a packed score. */
export function whispersFromScore(score: number): number {
  return Math.floor(score / WHISPER_SCALE);
}
