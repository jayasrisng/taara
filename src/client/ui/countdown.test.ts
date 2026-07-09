import { describe, expect, it } from 'vitest';
import { untilNextSky } from './countdown';

const seconds = (n: number): number => n * 1000;
const minutes = (n: number): number => seconds(n * 60);
const hours = (n: number): number => minutes(n * 60);

describe('untilNextSky', () => {
  it('drops the seconds when the wait is measured in hours', () => {
    expect(untilNextSky(hours(4) + minutes(12) + seconds(38))).toBe('Next sky in 4h 12m');
  });

  it('counts minutes and seconds within the last hour', () => {
    expect(untilNextSky(minutes(12) + seconds(4))).toBe('Next sky in 12m 4s');
  });

  it('counts down the final minute in seconds', () => {
    expect(untilNextSky(seconds(43))).toBe('Next sky in 43s');
    expect(untilNextSky(seconds(1))).toBe('Next sky in 1s');
  });

  it('stops counting once the sky has turned', () => {
    expect(untilNextSky(0)).toBe('A new sky is waiting');
    expect(untilNextSky(-5000)).toBe('A new sky is waiting');
  });

  it('never shows a bare hour without its minutes', () => {
    expect(untilNextSky(hours(1))).toBe('Next sky in 1h 0m');
  });

  it('rounds down, so it never promises a sky early', () => {
    expect(untilNextSky(seconds(59) + 999)).toBe('Next sky in 59s');
  });
});
