/**
 * Preview test — doubles as the "printout of 7 consecutive nights" sanity check
 * from the Step 3 verification. Running `npm test` logs the table below.
 */

import { describe, it, expect } from 'vitest';
import { describeNight, previewNights } from './puzzlePreview';

describe('puzzlePreview', () => {
  it('prints 7 consecutive nights for eyeballing variety', () => {
    const startNight = 8; // ≈ tonight during the hackathon (2026-07-08)
    const table = previewNights(startNight, 7, 'hard');
    console.log('\n7 consecutive nights (hard mode):\n' + table + '\n');
    expect(table.split('\n')).toHaveLength(7);
  });

  it('describeNight is deterministic', () => {
    expect(describeNight(8)).toBe(describeNight(8));
  });
});
