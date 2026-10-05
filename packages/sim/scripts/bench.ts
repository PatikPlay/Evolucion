/**
 * Simulation benchmark: `pnpm sim:bench [--organisms 1500] [--parcels 1]`.
 * Grows a population to the target size, then times one full round (4000 ticks).
 * Target (spec §11): a round of a 1500-organism parcel in under 25 s.
 */
import { parseArgs } from 'node:util';
import { ParcelSim, TICKS_PER_YEAR } from '../src/index';

const { values } = parseArgs({
  options: {
    organisms: { type: 'string', default: '1500' },
    seed: { type: 'string', default: 'bench' },
    ticks: { type: 'string', default: '4000' },
  },
});
const target = Number(values.organisms);
const sim = new ParcelSim({
  seed: values.seed ?? 'bench',
  config: { world: { targetProductivityPerCell: 12 } },
});
sim.stats.maxSamples = 500;
sim.spawnFounders({ key: 'base', traits: {} }, 120, 0);
let years = 0;
while (sim.org.liveCount < target && years < 60) {
  sim.run(TICKS_PER_YEAR);
  years++;
}
// Trim to the target size so runs are comparable.
if (sim.org.liveCount > target) sim.apply({ type: 'cull', keep: target });
const start = sim.org.liveCount;
const ticks = Number(values.ticks);
const t0 = process.hrtime.bigint();
sim.run(ticks);
const s = Number(process.hrtime.bigint() - t0) / 1e9;
const mean = (start + sim.org.liveCount) / 2;
console.log(
  `organisms ${start} → ${sim.org.liveCount} (mean ~${Math.round(mean)}) ticks ${ticks}: ${s.toFixed(2)} s (${((s / ticks) * 1000).toFixed(2)} ms/tick, ${((s / ticks / mean) * 1e6).toFixed(2)} µs/organism-tick)`,
);
console.log(`target: < 25 s per round for 1500 organisms → ${s < 25 ? 'OK' : 'TOO SLOW'}`);
