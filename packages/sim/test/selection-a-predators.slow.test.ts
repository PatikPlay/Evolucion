/**
 * H1 (a): with fast predators, prey mean speed rises significantly within
 * 10 generations, in at least 80 % of 20 seeds.
 */
import { expect, it } from 'vitest';
import { fastPredatorExperiment, seeds } from './support/experiments';
import { PASS_RATE, report } from './support/report';

it('(a) with fast predators, mean speed rises significantly within 10 generations', () => {
  const results = seeds(20).map((s) => fastPredatorExperiment(s));
  // Significant: at least 0.2 initial standard deviations above the paired control.
  const passed = results.filter((r) => r.effect > 0.2 && r.z > 2);
  report(
    '(a) fast predators',
    results.map((r) => `${r.seed} effect=${r.effect.toFixed(2)}sd z=${r.z.toFixed(1)} ${r.notes}`),
  );
  expect(passed.length / results.length).toBeGreaterThanOrEqual(PASS_RATE);
});
