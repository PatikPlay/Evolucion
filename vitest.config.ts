import { defineConfig } from 'vitest/config';

// Two projects: `fast` runs on every `pnpm test`; `slow` holds the long statistical
// experiments (selection experiments over many seeds, long stability runs).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'fast',
          include: ['packages/*/test/**/*.test.ts'],
          exclude: ['**/*.slow.test.ts', '**/node_modules/**'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
      {
        test: {
          name: 'slow',
          include: ['packages/*/test/**/*.slow.test.ts'],
          environment: 'node',
          testTimeout: 1_800_000,
          hookTimeout: 1_800_000,
        },
      },
    ],
  },
});
