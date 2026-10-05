/** H1 (b): under sustained cold, cold tolerance rises, in at least 80 % of 20 seeds. */
import { expect, it } from 'vitest';
import { coldExperiment, seeds } from './support/experiments';
import { PASS_RATE, report } from './support/report';

it('(b) under sustained cold, cold tolerance rises', () => {
  const results = seeds(20).map((s) => coldExperiment(s));
  const passed = results.filter((r) => r.effect > 0.2 && r.z > 2);
  report(
    '(b) sustained cold',
    results.map((r) => `${r.seed} effect=${r.effect.toFixed(2)}sd z=${r.z.toFixed(1)} ${r.notes}`),
  );
  expect(passed.length / results.length).toBeGreaterThanOrEqual(PASS_RATE);
});
