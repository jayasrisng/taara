/**
 * How long until the next sky, said the way a person would say it.
 *
 * Bedtime does not want a stopwatch. Hours away, seconds are noise; minutes
 * away, they matter; and when the wait is over the countdown stops counting and
 * simply invites.
 *
 * Pure and Phaser-free, so it can be tested on its own.
 */

export function untilNextSky(ms: number): string {
  if (ms <= 0) return 'A new sky is waiting';

  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) return `Next sky in ${hours}h ${minutes}m`;
  if (minutes > 0) return `Next sky in ${minutes}m ${rest}s`;
  return `Next sky in ${rest}s`;
}
