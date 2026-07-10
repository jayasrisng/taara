import { describe, expect, it } from 'vitest';
import { displayScale } from './display';

describe('displayScale', () => {
  it('renders a DPR-3 phone at its native ratio', () => {
    expect(displayScale(3, 390)).toBe(3);
  });

  it('still caps a large screen at 2', () => {
    expect(displayScale(3, 1024)).toBe(2);
    expect(displayScale(2, 1280)).toBe(2);
  });

  it('keeps a phone at the boundary on the phone side', () => {
    expect(displayScale(3, 540)).toBe(3);
    expect(displayScale(3, 541)).toBe(2);
  });

  it('passes fractional Android ratios through unrounded', () => {
    expect(displayScale(2.625, 412)).toBe(2.625);
    expect(displayScale(2.75, 412)).toBe(2.75);
  });

  it('never drops below 1, whatever the browser reports', () => {
    expect(displayScale(0, 390)).toBe(1);
    expect(displayScale(NaN, 390)).toBe(1);
    expect(displayScale(0.5, 390)).toBe(1);
  });
});
