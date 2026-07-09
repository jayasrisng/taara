import { beforeEach, describe, expect, it } from 'vitest';
import type { CompleteRequest } from '../../shared/api';
import { selectConstellationForNight } from '../../shared/puzzleEngine';
import { createFakeRedis } from './fakeRedis';
import { createStore, type Store } from './records';

const NIGHT = 12;

function play(overrides: Partial<CompleteRequest> = {}): CompleteRequest {
  return { difficulty: 'medium', timeMs: 60_000, whispers: 1, glitches: 2, ...overrides };
}

/** Real stars in the constellation a night resolves to. */
function starsOf(night: number): number {
  return selectConstellationForNight(night).stars.length;
}

describe('store', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore(createFakeRedis());
  });

  describe('first play', () => {
    it('records the result, lights the Jwala and counts the stars', async () => {
      const outcome = await store.recordCompletion('ana', NIGHT, play(), 1_000);

      expect(outcome.alreadyPlayed).toBe(false);
      expect(outcome.result).toEqual({
        night: NIGHT,
        difficulty: 'medium',
        timeMs: 60_000,
        whispers: 1,
        glitches: 2,
        starsConnected: starsOf(NIGHT),
        completedAt: 1_000,
      });
      expect(outcome.jwala).toEqual({ current: 1, longest: 1, lastNight: NIGHT });
      expect(outcome.community).toEqual({
        starsTonight: starsOf(NIGHT),
        playersTonight: 1,
      });
    });

    it('derives the star count from the night, never from the request', async () => {
      // The client sends no star count at all, so it cannot inflate the
      // community counter — each night's constellation decides the total.
      const fifth = await store.recordCompletion('ana', 5, play());
      const sixth = await store.recordCompletion('bo', 6, play());

      expect(fifth.result.starsConnected).toBe(starsOf(5));
      expect(sixth.result.starsConnected).toBe(starsOf(6));
    });

    it('adds the night’s constellation to My Sky', async () => {
      await store.recordCompletion('ana', NIGHT, play());
      expect(await store.loadMySky('ana')).toEqual([
        { constellationId: selectConstellationForNight(NIGHT).id, night: NIGHT },
      ]);
    });

    it('is readable back as the player’s result for that night', async () => {
      await store.recordCompletion('ana', NIGHT, play(), 5_000);
      const stored = await store.loadResult(NIGHT, 'ana');
      expect(stored?.completedAt).toBe(5_000);
      expect(await store.loadResult(NIGHT + 1, 'ana')).toBeNull();
      expect(await store.loadResult(NIGHT, 'bo')).toBeNull();
    });
  });

  describe('repeat play on the same night', () => {
    it('returns the original result and counts nothing twice', async () => {
      const first = await store.recordCompletion('ana', NIGHT, play({ timeMs: 30_000 }), 1_000);

      const second = await store.recordCompletion(
        'ana',
        NIGHT,
        play({ difficulty: 'hard', timeMs: 10_000, whispers: 3 }),
        2_000
      );

      expect(second.alreadyPlayed).toBe(true);
      expect(second.result).toEqual(first.result);
      expect(second.jwala).toEqual({ current: 1, longest: 1, lastNight: NIGHT });
      expect(second.community).toEqual(first.community);
    });

    it('does not add a duplicate leaderboard entry', async () => {
      await store.recordCompletion('ana', NIGHT, play({ difficulty: 'hard', timeMs: 30_000 }));
      await store.recordCompletion('ana', NIGHT, play({ difficulty: 'hard', timeMs: 1 }));

      const boards = await store.loadLeaderboards(NIGHT);
      expect(boards.fastest).toEqual([{ username: 'ana', value: 30_000, rank: 1 }]);
    });

    it('does not double the community counters', async () => {
      await store.recordCompletion('ana', NIGHT, play());
      await store.recordCompletion('ana', NIGHT, play());
      await store.recordCompletion('bo', NIGHT, play());

      expect(await store.loadCommunity(NIGHT)).toEqual({
        starsTonight: starsOf(NIGHT) * 2,
        playersTonight: 2,
      });
    });

    /**
     * The record is the first solve of the night, at the difficulty it was
     * actually played. A later solve at another difficulty must not rewrite it
     * — the results screen reads this back, and a share card is built from it.
     */
    it('keeps the first solve’s difficulty when a second is played', async () => {
      await store.recordCompletion('ana', NIGHT, play({ difficulty: 'hard', timeMs: 16_000 }));
      const replay = await store.recordCompletion('ana', NIGHT, play({ difficulty: 'easy', timeMs: 90_000 }));

      expect(replay.alreadyPlayed).toBe(true);
      expect(replay.result.difficulty).toBe('hard');
      expect(replay.result.timeMs).toBe(16_000);
      expect(await store.loadResult(NIGHT, 'ana')).toMatchObject({ difficulty: 'hard', timeMs: 16_000 });
    });

    /**
     * Fastest is a Hard-mode board. An Easy solve is recorded first, so the
     * later Hard solve is never written — the board must stay empty rather than
     * pick up a time from a night whose record is not a Hard one.
     */
    it('never files a Fastest time for a night recorded on Easy', async () => {
      await store.recordCompletion('ana', NIGHT, play({ difficulty: 'easy', timeMs: 90_000, whispers: 0 }));
      await store.recordCompletion('ana', NIGHT, play({ difficulty: 'hard', timeMs: 16_000 }));

      const boards = await store.loadLeaderboards(NIGHT);
      expect(boards.fastest).toEqual([]);
      expect(boards.fewestWhispers).toEqual([]);
    });
  });

  describe('Jwala streak across nights', () => {
    it('grows on consecutive nights', async () => {
      await store.recordCompletion('ana', 5, play());
      const second = await store.recordCompletion('ana', 6, play());
      const third = await store.recordCompletion('ana', 7, play());

      expect(second.jwala).toEqual({ current: 2, longest: 2, lastNight: 6 });
      expect(third.jwala).toEqual({ current: 3, longest: 3, lastNight: 7 });
    });

    it('resets after a missed night but remembers the longest', async () => {
      await store.recordCompletion('ana', 5, play());
      await store.recordCompletion('ana', 6, play());
      const afterGap = await store.recordCompletion('ana', 9, play());

      expect(afterGap.jwala).toEqual({ current: 1, longest: 2, lastNight: 9 });
    });

    it('leaves the flame untouched when an old archive night is completed', async () => {
      await store.recordCompletion('ana', 8, play());
      await store.recordCompletion('ana', 9, play());
      const archive = await store.recordCompletion('ana', 3, play());

      expect(archive.alreadyPlayed).toBe(false);
      expect(archive.jwala).toEqual({ current: 2, longest: 2, lastNight: 9 });
      // ...but the constellation is still collected.
      const sky = await store.loadMySky('ana');
      expect(sky.map((entry) => entry.night)).toEqual([9, 8, 3]);
    });

    it('is not disturbed by another player’s nights', async () => {
      await store.recordCompletion('ana', 5, play());
      await store.recordCompletion('bo', 5, play());
      await store.recordCompletion('bo', 6, play());

      expect(await store.loadJwala('ana')).toEqual({ current: 1, longest: 1, lastNight: 5 });
      expect(await store.loadJwala('bo')).toEqual({ current: 2, longest: 2, lastNight: 6 });
    });

    it('reports an empty Jwala for a player who has never played', async () => {
      expect(await store.loadJwala('nobody')).toEqual({ current: 0, longest: 0, lastNight: 0 });
    });
  });

  describe('My Sky', () => {
    it('collects one entry per constellation, newest night first', async () => {
      await store.recordCompletion('ana', 5, play());
      await store.recordCompletion('ana', 6, play());
      await store.recordCompletion('ana', 7, play());

      const sky = await store.loadMySky('ana');
      expect(sky.map((entry) => entry.night)).toEqual([7, 6, 5]);
      expect(new Set(sky.map((entry) => entry.constellationId)).size).toBe(3);
    });

    it('refreshes the night when a constellation comes round again', async () => {
      // The no-repeat window is 15 nights, so night N and N+15 may share a
      // constellation. Find such a pair and confirm My Sky dedupes to one entry.
      const first = 1;
      const target = selectConstellationForNight(first).id;
      let repeat = 0;
      for (let night = first + 1; night < 200; night++) {
        if (selectConstellationForNight(night).id === target) {
          repeat = night;
          break;
        }
      }
      expect(repeat).toBeGreaterThan(first);

      await store.recordCompletion('ana', first, play());
      await store.recordCompletion('ana', repeat, play());

      const sky = await store.loadMySky('ana');
      const entries = sky.filter((entry) => entry.constellationId === target);
      expect(entries).toEqual([{ constellationId: target, night: repeat }]);
    });

    it('is empty for a new player', async () => {
      expect(await store.loadMySky('nobody')).toEqual([]);
    });
  });

  describe('soft leaderboards', () => {
    it('ranks fastest solves ascending, Hard mode only', async () => {
      await store.recordCompletion('slow', NIGHT, play({ difficulty: 'hard', timeMs: 90_000 }));
      await store.recordCompletion('quick', NIGHT, play({ difficulty: 'hard', timeMs: 20_000 }));
      await store.recordCompletion('easyplayer', NIGHT, play({ difficulty: 'easy', whispers: 0 }));
      await store.recordCompletion('medplayer', NIGHT, play({ difficulty: 'medium' }));

      const boards = await store.loadLeaderboards(NIGHT);
      expect(boards.fastest).toEqual([
        { username: 'quick', value: 20_000, rank: 1 },
        { username: 'slow', value: 90_000, rank: 2 },
      ]);
    });

    it('ranks fewest Whispers ascending, excluding Easy, tie-broken by time', async () => {
      await store.recordCompletion('two', NIGHT, play({ whispers: 2, timeMs: 10_000 }));
      await store.recordCompletion('zeroSlow', NIGHT, play({ whispers: 0, timeMs: 80_000 }));
      await store.recordCompletion('zeroFast', NIGHT, play({ whispers: 0, timeMs: 40_000 }));
      await store.recordCompletion('easyplayer', NIGHT, play({ difficulty: 'easy', whispers: 0 }));

      const boards = await store.loadLeaderboards(NIGHT);
      expect(boards.fewestWhispers).toEqual([
        { username: 'zeroFast', value: 0, rank: 1 },
        { username: 'zeroSlow', value: 0, rank: 2 },
        { username: 'two', value: 2, rank: 3 },
      ]);
    });

    it('ranks the longest burning Jwala descending', async () => {
      await store.recordCompletion('ana', 5, play());
      await store.recordCompletion('ana', 6, play());
      await store.recordCompletion('ana', 7, play());
      await store.recordCompletion('bo', 7, play());

      const boards = await store.loadLeaderboards(7);
      expect(boards.longestJwala).toEqual([
        { username: 'ana', value: 3, rank: 1 },
        { username: 'bo', value: 1, rank: 2 },
      ]);
    });

    it('lowers a player’s Jwala rank when their streak breaks', async () => {
      await store.recordCompletion('ana', 5, play());
      await store.recordCompletion('ana', 6, play());
      await store.recordCompletion('bo', 8, play());
      await store.recordCompletion('bo', 9, play());
      await store.recordCompletion('ana', 9, play()); // ana missed nights 7 and 8

      const boards = await store.loadLeaderboards(9);
      expect(boards.longestJwala).toEqual([
        { username: 'bo', value: 2, rank: 1 },
        { username: 'ana', value: 1, rank: 2 },
      ]);
    });

    it('keeps each night’s boards separate', async () => {
      await store.recordCompletion('ana', 5, play({ difficulty: 'hard', timeMs: 1_000 }));
      const other = await store.loadLeaderboards(6);
      expect(other.fastest).toEqual([]);
      expect(other.fewestWhispers).toEqual([]);
    });

    it('shows at most ten stargazers per board', async () => {
      for (let i = 0; i < 14; i++) {
        await store.recordCompletion(`p${i}`, NIGHT, play({ difficulty: 'hard', timeMs: i * 100 }));
      }
      const boards = await store.loadLeaderboards(NIGHT);
      expect(boards.fastest).toHaveLength(10);
      expect(boards.fastest[0]?.username).toBe('p0');
      expect(boards.fastest[9]?.username).toBe('p9');
    });

    it('is empty on a night nobody has finished', async () => {
      const boards = await store.loadLeaderboards(99);
      expect(boards).toEqual({ fastest: [], fewestWhispers: [], longestJwala: [] });
    });
  });

  describe('posts and their nights', () => {
    it('reads a pinned night back from either end', async () => {
      await store.savePostNight('t3_abc', 12);

      expect(await store.loadPostNight('t3_abc')).toBe(12);
      expect(await store.loadNightPost(12)).toBe('t3_abc');
    });

    it('knows nothing about a post it never pinned', async () => {
      expect(await store.loadPostNight('t3_unknown')).toBeNull();
      expect(await store.loadNightPost(7)).toBeNull();
    });

    it('keeps each post on its own night', async () => {
      await store.savePostNight('t3_old', 3);
      await store.savePostNight('t3_new', 9);

      expect(await store.loadPostNight('t3_old')).toBe(3);
      expect(await store.loadPostNight('t3_new')).toBe(9);
    });

    it('lets a re-created night point at the newest post', async () => {
      await store.savePostNight('t3_first', 4);
      await store.savePostNight('t3_second', 4);

      expect(await store.loadNightPost(4)).toBe('t3_second');
      // The old post keeps playing night 4 — it was never unpinned.
      expect(await store.loadPostNight('t3_first')).toBe(4);
    });
  });
});
