import { describe, expect, it } from 'vitest';
import { contentWidth, gutter, margin, rhythm, type Viewport } from './frame';
import { space } from './theme';

/** The narrowest screen the game supports, and a tall modern phone. */
const TINY: Viewport = { w: 320, h: 480 };
const PHONE: Viewport = { w: 390, h: 844 };
const DESKTOP: Viewport = { w: 1280, h: 900 };

describe('the page frame', () => {
  it('never falls below its smallest token, however cramped the screen', () => {
    const cramped: Viewport = { w: 200, h: 200 };
    expect(gutter(cramped)).toBe(space.md);
    expect(margin(cramped)).toBe(space.md);
    expect(rhythm(cramped)).toBe(space.sm);
  });

  it('never grows past its largest token, however roomy the screen', () => {
    const vast: Viewport = { w: 4000, h: 4000 };
    expect(gutter(vast)).toBe(space.xxl);
    expect(margin(vast)).toBe(space.xxl);
    expect(rhythm(vast)).toBe(space.lg);
  });

  it('gives a bigger screen more room than a smaller one', () => {
    expect(gutter(DESKTOP)).toBeGreaterThan(gutter(TINY));
    expect(margin(PHONE)).toBeGreaterThan(margin(TINY));
  });

  it('keeps the rhythm tighter than the margin around it', () => {
    for (const view of [TINY, PHONE, DESKTOP]) {
      expect(rhythm(view)).toBeLessThanOrEqual(margin(view));
    }
  });

  it('leaves a usable column on the narrowest supported screen', () => {
    // 320px wide is the floor named in PROGRESS; the content must still be wide
    // enough for a 200px pill plus its own padding.
    expect(contentWidth(TINY)).toBeGreaterThan(200 + space.xl);
    expect(contentWidth(TINY)).toBe(320 - gutter(TINY) * 2);
  });

  it('scales the gutter with width, not height', () => {
    const wide: Viewport = { w: 600, h: 200 };
    const tall: Viewport = { w: 200, h: 600 };
    expect(gutter(wide)).toBeGreaterThan(gutter(tall));
    expect(margin(tall)).toBeGreaterThan(margin(wide));
  });
});
