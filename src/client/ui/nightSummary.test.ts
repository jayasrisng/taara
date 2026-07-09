import { describe, expect, it } from 'vitest';
import type { NightResult } from '../../shared/api';
import type { Difficulty } from '../../shared/constellations';
import { describeNight, sameSolve, summariseNight } from './nightSummary';

function result(difficulty: Difficulty, over: Partial<NightResult> = {}): NightResult {
  return {
    night: 9,
    difficulty,
    timeMs: 16_000,
    whispers: 0,
    glitches: 0,
    starsConnected: 10,
    completedAt: 0,
    ...over,
  };
}

describe('describeNight', () => {
  it('names the difficulty it was given', () => {
    expect(describeNight(result('easy'))).toMatch(/^Easy/);
    expect(describeNight(result('medium'))).toMatch(/^Medium/);
    expect(describeNight(result('hard'))).toMatch(/^Hard/);
  });

  it('shows the timer on Hard and nowhere else', () => {
    expect(describeNight(result('hard'))).toContain('0:16');
    expect(describeNight(result('easy'))).not.toContain('0:16');
    expect(describeNight(result('medium'))).not.toContain('0:16');
  });

  it('counts Whispers, and says so when there were none', () => {
    expect(describeNight(result('medium', { whispers: 0 }))).toContain('no Whispers');
    expect(describeNight(result('medium', { whispers: 1 }))).toContain('1 Whisper');
    expect(describeNight(result('medium', { whispers: 2 }))).toContain('2 Whispers');
  });

  it('carries the mood', () => {
    expect(describeNight(result('easy'))).toContain('Mood: Luminous');
    expect(describeNight(result('easy', { whispers: 3, glitches: 4 }))).toContain('Mood: Drowsy');
  });
});

describe('sameSolve', () => {
  it('is true for the same solve', () => {
    expect(sameSolve(result('easy'), result('easy'))).toBe(true);
  });

  it('is false across difficulties, times and Whispers', () => {
    expect(sameSolve(result('hard'), result('easy'))).toBe(false);
    expect(sameSolve(result('hard'), result('hard', { timeMs: 90_000 }))).toBe(false);
    expect(sameSolve(result('hard'), result('hard', { whispers: 1 }))).toBe(false);
  });
});

describe('summariseNight', () => {
  it('describes the solve just played when there is no record yet', () => {
    const summary = summariseNight(result('easy'), null);
    expect(summary.headline).toMatch(/^Easy/);
    expect(summary.note).toBeNull();
  });

  it('stays quiet when the record is the solve just played', () => {
    const summary = summariseNight(result('hard'), result('hard'));
    expect(summary.headline).toMatch(/^Hard/);
    expect(summary.note).toBeNull();
  });

  /**
   * The Step 7.5 bug. Solve Hard in 16s, then replay Easy: the night's record is
   * write-once, so it still describes the Hard solve. The screen used to render
   * that record verbatim under the Easy play — "Hard · 0:16".
   */
  it('never labels an Easy replay with the recorded Hard solve', () => {
    const record = result('hard', { timeMs: 16_000 });
    const replay = result('easy', { timeMs: 90_000 });

    const summary = summariseNight(replay, record);

    expect(summary.headline).toMatch(/^Easy/);
    expect(summary.headline).not.toContain('Hard');
    expect(summary.headline).not.toContain('0:16');

    // The record is not hidden — it is attributed, because the share card is
    // built from it.
    expect(summary.note).toContain('Hard');
    expect(summary.note).toContain('0:16');
  });

  it('attributes the record when the replay is a harder one', () => {
    const summary = summariseNight(result('hard', { timeMs: 16_000 }), result('easy', { timeMs: 90_000 }));
    expect(summary.headline).toMatch(/^Hard/);
    expect(summary.note).toContain('Easy');
  });
});
