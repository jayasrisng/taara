/**
 * The store, bound to the live Devvit Redis client.
 *
 * This is the only module that reaches for the real Redis, which keeps
 * records.ts importable (and testable) without a Devvit runtime.
 */

import { redis } from '@devvit/web/server';
import { createStore } from './records';

export const store = createStore(redis);
