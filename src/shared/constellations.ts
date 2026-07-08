/**
 * Constellation data types for TaaraNight
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Star {
  /** X position, normalized to 0-1 range */
  x: number;
  /** Y position, normalized to 0-1 range */
  y: number;
}

export interface Connection {
  /** Index of the first star in the stars array */
  from: number;
  /** Index of the second star in the stars array */
  to: number;
}

export interface Constellation {
  /** Unique identifier */
  id: string;
  /** Display name of the constellation */
  name: string;
  /** Star positions, normalized to 0-1 box */
  stars: Star[];
  /** Connections between stars (by index) */
  connections: Connection[];
  /** Difficulty level */
  difficulty: Difficulty;
  /** Bedtime story/myth (3-5 sentences, calming tone) */
  story: string;
}

export interface ConstellationDataset {
  constellations: Constellation[];
}
