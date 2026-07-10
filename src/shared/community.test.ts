import { describe, expect, it } from 'vitest';
import { communityMilestone } from './community';

describe('communityMilestone', () => {
  it('invites the first solve without shaming an empty night', () => {
    expect(communityMilestone({ starsTonight: 0, playersTonight: 0 })).toBe('Be first to light 100 stars tonight');
  });

  it('sets the next shared goal above the current star count', () => {
    expect(communityMilestone({ starsTonight: 214, playersTonight: 12 })).toBe(
      '214 of 500 community stars lit tonight'
    );
    expect(communityMilestone({ starsTonight: 500, playersTonight: 28 })).toBe(
      '500 of 1,000 community stars lit tonight'
    );
  });

  it('can describe archive posts in their own night', () => {
    expect(communityMilestone({ starsTonight: 42, playersTonight: 3 }, true)).toBe(
      '42 of 500 community stars lit that night'
    );
  });
});
