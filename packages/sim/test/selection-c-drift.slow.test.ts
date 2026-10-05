/**
 * H1 (c): without added pressure, neutral traits drift without a trend: across
 * 20 seeds their mean change is not distinguishable from zero, yet they do move.
 */
import { expect, it } from 'vitest';
import { driftExperiment, NEUTRAL_TRAITS, seeds } from './support/experiments';
import { PASS_RATE } from './support/report';

it('(c) without pressure, neutral traits drift without a trend', () => {
  const results = seeds(20).map((s) => driftExperiment(s));
  const k = NEUTRAL_TRAITS.length;
  const traitPasses: boolean[] = [];
  for (let t = 0; t < k; t++) {
    const d = results.map((r) => r.deltas[t] as number);
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (d.length - 1));
    const tStat = mean / (sd / Math.sqrt(d.length));
    const up = d.filter((x) => x > 0).length / d.length;
    traitPasses.push(Math.abs(tStat) < 2.1 && up > 0.2 && up < 0.8);
    console.log(
      `(c) trait ${t}: mean change ${mean.toFixed(2)}sd t=${tStat.toFixed(2)} up=${(up * 100).toFixed(0)}%`,
    );
  }
  const drifting = results.filter((r) => r.deltas.some((x) => Math.abs(x) > 0.05));
  expect(traitPasses.filter(Boolean).length / k).toBeGreaterThanOrEqual(PASS_RATE);
  expect(drifting.length / results.length).toBeGreaterThanOrEqual(PASS_RATE);
});
