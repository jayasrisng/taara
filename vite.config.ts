// Use vitest's defineConfig so the `test` field below is typed.
import { defineConfig } from 'vitest/config';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [
    devvit({
      client: {
        build: {
          chunkSizeWarningLimit: 2000,
        },
      },
    }),
  ],
  // Only run tests from source; never the compiled copies emitted to dist/ by
  // `tsc --build`, which would otherwise double every test run.
  test: {
    include: ['src/**/*.test.ts'],
  },
});
