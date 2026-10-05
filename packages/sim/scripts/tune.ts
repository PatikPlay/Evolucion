/**
 * Tuning harness: runs one seed with config overrides and prints a one-line
 * JSON summary. Used in parallel by scripts/tune.sh.
 *   tsx packages/sim/scripts/tune.ts <seed> <years> '<config json>'
 */
import { ParcelSim, TICKS_PER_YEAR, T, ACT_COUNT } from '../src/index';

const [seed = 's', yearsArg = '10', cfgArg = '{}'] = process.argv.slice(2);
const years = Number(yearsArg);
const sim = new ParcelSim({ seed, config: JSON.parse(cfgArg) });
sim.spawnFounders({ key: 'base', traits: {} }, 30, 0);
const pops: number[] = [];
const acts = new Array<number>(ACT_COUNT).fill(0);
let actTotal = 0;
let massT0 = 0;
for (let y = 0; y < years; y++) {
  for (let t = 0; t < TICKS_PER_YEAR; t++) {
    sim.step();
    if (t % 25 === 0) {
      for (let i = 0; i < sim.org.high; i++) {
        if (!sim.org.alive[i]) continue;
        acts[sim.org.action[i] as number]!++;
        actTotal++;
      }
    }
  }
  pops.push(sim.org.liveCount);
  if (y === 0) massT0 = sim.stats.latest(1)?.traitMean[T.Mass] ?? 0;
}
const last = sim.stats.latest(1);
const deaths = new Array<number>(11).fill(0);
for (const s of sim.stats.samples) s.period.deaths.forEach((d, k) => (deaths[k]! += d));
console.log(
  JSON.stringify({
    seed,
    pops,
    massT0: +massT0.toFixed(3),
    massT: +(last?.traitMean[T.Mass] ?? 0).toFixed(3),
    mass: +(last?.massMean ?? 0).toFixed(2),
    gen: +(last?.generationMean ?? 0).toFixed(1),
    deaths,
    acts: acts.map((a) => +((100 * a) / Math.max(1, actTotal)).toFixed(1)),
  }),
);
