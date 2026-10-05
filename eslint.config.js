import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const nondeterminism = [
  { object: 'Math', property: 'random', message: 'Use the seeded Rng from @linaje/sim instead.' },
  { object: 'Date', property: 'now', message: 'Simulation and rules must not read the clock.' },
  {
    object: 'performance',
    property: 'now',
    message: 'Simulation and rules must not read the clock.',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'batch-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Determinism: sim and game are pure functions of seed + inputs.
    files: ['packages/sim/src/**/*.ts', 'packages/game/src/**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', ...nondeterminism],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'No timers in sim/game.' },
        { name: 'setInterval', message: 'No timers in sim/game.' },
      ],
    },
  },
  {
    // sim must stay free of DOM and Node APIs so it runs anywhere (workers, tests, batch).
    files: ['packages/sim/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*', 'fs', 'path', 'worker_threads', 'os'],
              message: 'sim/src must not use Node APIs.',
            },
            { group: ['@linaje/*'], message: 'sim depends on nothing.' },
          ],
        },
      ],
    },
  },
  {
    // The client may only talk to the outside world through protocol types.
    files: ['packages/client/src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@linaje/sim',
                '@linaje/sim/*',
                '@linaje/game',
                '@linaje/game/*',
                '@linaje/server',
              ],
              message: 'The client only depends on @linaje/protocol.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/protocol/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@linaje/*'], message: 'protocol depends on nothing.' }] },
      ],
    },
  },
);
