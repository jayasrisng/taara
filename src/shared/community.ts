import type { CommunityStats } from './api';

const FIRST_MILESTONE = 100;
const MILESTONE_STEP = 500;

function milestoneFor(stars: number): number {
  if (stars <= 0) return FIRST_MILESTONE;
  return Math.max(FIRST_MILESTONE, Math.ceil((stars + 1) / MILESTONE_STEP) * MILESTONE_STEP);
}

/** A Reddit-native community target: everyone is lighting the same sky. */
export function communityMilestone(stats: CommunityStats, archive = false): string {
  const when = archive ? 'that night' : 'tonight';
  if (stats.starsTonight <= 0) {
    return `Be first to light ${FIRST_MILESTONE.toLocaleString()} stars ${when}`;
  }

  const next = milestoneFor(stats.starsTonight);
  const stars = stats.starsTonight.toLocaleString();
  const goal = next.toLocaleString();
  return `${stars} of ${goal} community stars lit ${when}`;
}
