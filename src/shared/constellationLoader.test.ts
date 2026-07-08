/**
 * Tests for constellation data loader and validation
 */

import { describe, it, expect } from 'vitest';
import {
  loadConstellations,
  getConstellationById,
  getConstellationsByDifficulty,
  getConstellationByIndex,
  getConstellationCount,
  getDatasetStats,
} from './constellationLoader';

describe('Constellation Loader', () => {
  describe('loadConstellations', () => {
    it('should load the dataset without errors', () => {
      expect(() => loadConstellations()).not.toThrow();
    });

    it('should return a dataset with constellations', () => {
      const dataset = loadConstellations();
      expect(dataset).toBeDefined();
      expect(dataset.constellations).toBeDefined();
      expect(Array.isArray(dataset.constellations)).toBe(true);
      expect(dataset.constellations.length).toBeGreaterThan(0);
    });

    it('should have at least 15 constellations (requirement)', () => {
      const dataset = loadConstellations();
      expect(dataset.constellations.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Data Validation', () => {
    it('should have valid star positions (0-1 range) for all constellations', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        constellation.stars.forEach((star) => {
          expect(star.x).toBeGreaterThanOrEqual(0);
          expect(star.x).toBeLessThanOrEqual(1);
          expect(star.y).toBeGreaterThanOrEqual(0);
          expect(star.y).toBeLessThanOrEqual(1);
        });
      });
    });

    it('should have valid connection indices for all constellations', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        const starCount = constellation.stars.length;
        constellation.connections.forEach((conn) => {
          expect(conn.from).toBeGreaterThanOrEqual(0);
          expect(conn.from).toBeLessThan(starCount);
          expect(conn.to).toBeGreaterThanOrEqual(0);
          expect(conn.to).toBeLessThan(starCount);
        });
      });
    });

    it('should have unique IDs for all constellations', () => {
      const dataset = loadConstellations();
      const ids = dataset.constellations.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have valid difficulty levels', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        expect(['easy', 'medium', 'hard']).toContain(constellation.difficulty);
      });
    });

    it('should have non-empty stories for all constellations', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        expect(constellation.story).toBeDefined();
        expect(typeof constellation.story).toBe('string');
        expect(constellation.story.trim().length).toBeGreaterThan(0);
      });
    });

    it('should have at least one star for each constellation', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        expect(constellation.stars.length).toBeGreaterThan(0);
      });
    });

    it('should have at least one connection for each constellation', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        expect(constellation.connections.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getConstellationById', () => {
    it('should return a constellation when given a valid ID', () => {
      const dataset = loadConstellations();
      const firstConstellation = dataset.constellations[0];
      expect(firstConstellation).toBeDefined();
      if (!firstConstellation) return;

      const firstId = firstConstellation.id;
      const constellation = getConstellationById(firstId);
      expect(constellation).toBeDefined();
      if (constellation) {
        expect(constellation.id).toBe(firstId);
      }
    });

    it('should return undefined for an invalid ID', () => {
      const constellation = getConstellationById('nonexistent-constellation');
      expect(constellation).toBeUndefined();
    });
  });

  describe('getConstellationsByDifficulty', () => {
    it('should return only easy constellations', () => {
      const easy = getConstellationsByDifficulty('easy');
      expect(easy.length).toBeGreaterThan(0);
      easy.forEach((c) => {
        expect(c.difficulty).toBe('easy');
      });
    });

    it('should return only medium constellations', () => {
      const medium = getConstellationsByDifficulty('medium');
      expect(medium.length).toBeGreaterThan(0);
      medium.forEach((c) => {
        expect(c.difficulty).toBe('medium');
      });
    });

    it('should return only hard constellations', () => {
      const hard = getConstellationsByDifficulty('hard');
      expect(hard.length).toBeGreaterThan(0);
      hard.forEach((c) => {
        expect(c.difficulty).toBe('hard');
      });
    });
  });

  describe('getConstellationByIndex', () => {
    it('should return a constellation for index 0', () => {
      const constellation = getConstellationByIndex(0);
      expect(constellation).toBeDefined();
    });

    it('should wrap around for large indices', () => {
      const count = getConstellationCount();
      const constellation1 = getConstellationByIndex(0);
      const constellation2 = getConstellationByIndex(count);
      expect(constellation1.id).toBe(constellation2.id);
    });

    it('should handle negative indices', () => {
      const count = getConstellationCount();
      const constellation1 = getConstellationByIndex(-1);
      const constellationLast = getConstellationByIndex(count - 1);
      expect(constellation1.id).toBe(constellationLast.id);
    });

    it('should be deterministic (same index = same constellation)', () => {
      const constellation1 = getConstellationByIndex(5);
      const constellation2 = getConstellationByIndex(5);
      expect(constellation1.id).toBe(constellation2.id);
    });
  });

  describe('getConstellationCount', () => {
    it('should return the correct count', () => {
      const dataset = loadConstellations();
      expect(getConstellationCount()).toBe(dataset.constellations.length);
    });
  });

  describe('getDatasetStats', () => {
    it('should return correct stats', () => {
      const stats = getDatasetStats();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.easy).toBeGreaterThan(0);
      expect(stats.medium).toBeGreaterThan(0);
      expect(stats.hard).toBeGreaterThan(0);
      expect(stats.easy + stats.medium + stats.hard).toBe(stats.total);
    });

    it('should have a balanced difficulty distribution', () => {
      const stats = getDatasetStats();
      // Each difficulty should have at least 3 constellations for variety
      expect(stats.easy).toBeGreaterThanOrEqual(3);
      expect(stats.medium).toBeGreaterThanOrEqual(3);
      expect(stats.hard).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Difficulty Complexity', () => {
    it('should have easy constellations with fewer stars than hard', () => {
      const easy = getConstellationsByDifficulty('easy');
      const hard = getConstellationsByDifficulty('hard');

      const avgEasyStars = easy.reduce((sum, c) => sum + c.stars.length, 0) / easy.length;
      const avgHardStars = hard.reduce((sum, c) => sum + c.stars.length, 0) / hard.length;

      expect(avgEasyStars).toBeLessThan(avgHardStars);
    });

    it('should have reasonable star counts by difficulty', () => {
      const easy = getConstellationsByDifficulty('easy');
      const hard = getConstellationsByDifficulty('hard');

      easy.forEach((c) => {
        expect(c.stars.length).toBeLessThanOrEqual(5);
      });

      hard.forEach((c) => {
        expect(c.stars.length).toBeGreaterThanOrEqual(6);
      });
    });
  });

  describe('Story Quality', () => {
    it('should have stories that are at least 100 characters (substantial)', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        expect(constellation.story.length).toBeGreaterThanOrEqual(100);
      });
    });

    it('should have stories with multiple sentences', () => {
      const dataset = loadConstellations();
      dataset.constellations.forEach((constellation) => {
        const sentenceCount = (constellation.story.match(/[.!?]+/g) || []).length;
        expect(sentenceCount).toBeGreaterThanOrEqual(3);
      });
    });
  });
});
