import { describe, expect, it } from 'vitest';
import { MOODS, moodFor, wander } from './mood';

describe('moodFor', () => {
  it('calls a flawless solve Luminous', () => {
    expect(moodFor({ whispers: 0, glitches: 0 })).toBe('Luminous');
  });

  it('softens by degrees as the player needs more help', () => {
    expect(moodFor({ whispers: 0, glitches: 2 })).toBe('Serene');
    expect(moodFor({ whispers: 1, glitches: 0 })).toBe('Serene');
    expect(moodFor({ whispers: 1, glitches: 3 })).toBe('Dreamy');
    expect(moodFor({ whispers: 2, glitches: 1 })).toBe('Dreamy');
    // Spending every Whisper is a Drowsy night on its own, Glitches or not.
    expect(moodFor({ whispers: 3, glitches: 0 })).toBe('Drowsy');
    expect(moodFor({ whispers: 0, glitches: 6 })).toBe('Drowsy');
  });

  it('weighs a deliberate Whisper more than an accidental Glitch', () => {
    expect(wander({ whispers: 1, glitches: 0 })).toBe(2);
    expect(wander({ whispers: 0, glitches: 1 })).toBe(1);
  });

  it('stops counting Glitches past the ceiling, so a bad night cannot get worse', () => {
    expect(wander({ whispers: 0, glitches: 6 })).toBe(6);
    expect(wander({ whispers: 0, glitches: 500 })).toBe(6);
  });

  it('only ever returns a known mood', () => {
    for (let whispers = 0; whispers <= 3; whispers++) {
      for (let glitches = 0; glitches <= 20; glitches++) {
        expect(MOODS).toContain(moodFor({ whispers, glitches }));
      }
    }
  });
});
