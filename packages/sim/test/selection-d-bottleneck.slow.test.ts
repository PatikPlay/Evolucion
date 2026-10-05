/**
 * H1 (d): a bottleneck reduces genetic diversity and makes recessive
 * deleterious alleles surface, in at least 80 % of 20 seeds.
 */
import { expect, it } from 'vitest';
import { bottleneckExperiment, seeds } from './support/experiments';
import { PASS_RATE, report } from './support/report';

it('(d) a bottleneck reduces diversity and makes recessive deleterious alleles surface', () => {
  const results = seeds(20).map((s) => bottleneckExperiment(s));
  const passed = results.filter(
    (r) =>
      r.countTreated > 0 &&
      r.diversityTreated < r.diversityControl * 0.85 &&
      r.loadTreated > r.loadControl * 1.3,
  );
  report(
    '(d) bottleneck',
    results.map(
      (r) =>
        `${r.seed} diversity ${r.diversityControl.toFixed(3)}→${r.diversityTreated.toFixed(3)} load ${r.loadControl.toFixed(3)}→${r.loadTreated.toFixed(3)} n=${r.countTreated}`,
    ),
  );
  expect(passed.length / results.length).toBeGreaterThanOrEqual(PASS_RATE);
});
