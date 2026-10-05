/**
 * Headless runner: `pnpm sim:run --seed abc --years 10 [--founders 30] [--predators 0]`.
 * Prints a yearly census of every species and the final state hash.
 */
import { parseArgs } from 'node:util';
import {
  DEATH_CAUSES,
  FOOD_KEYS,
  ParcelSim,
  TICKS_PER_YEAR,
  hashToHex,
  T,
  NPC_LINEAGE_BASE,
} from '../src/index';
import { PREDATOR_TEMPLATE } from '../src/genetics/archetypes';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: 'linaje' },
    years: { type: 'string', default: '10' },
    founders: { type: 'string', default: '30' },
    predators: { type: 'string', default: '0' },
    predatorYear: { type: 'string', default: '2' },
    quiet: { type: 'boolean', default: false },
  },
});

const years = Number(values.years);
const sim = new ParcelSim({ seed: values.seed ?? 'linaje' });
const sp = sim.spawnFounders({ key: 'base', traits: {} }, Number(values.founders), 0);
const t0 = process.hrtime.bigint();
for (let y = 0; y < years; y++) {
  if (y === Number(values.predatorYear) && Number(values.predators) > 0) {
    sim.spawnFounders(PREDATOR_TEMPLATE, Number(values.predators), NPC_LINEAGE_BASE, {
      archetype: 'predator',
    });
  }
  sim.run(TICKS_PER_YEAR);
  if (values.quiet) continue;
  const lines: string[] = [];
  for (const info of sim.species.list) {
    const recent = sim.stats.samples.filter(
      (s) => s.species === info.id && s.tick > sim.tick - TICKS_PER_YEAR,
    );
    const last = recent[recent.length - 1];
    if (!last) continue;
    const deaths = new Array<number>(DEATH_CAUSES.length).fill(0);
    const diet = new Array<number>(FOOD_KEYS.length).fill(0);
    let births = 0;
    for (const s of recent) {
      s.period.deaths.forEach((d, k) => (deaths[k]! += d));
      s.period.diet.forEach((d, k) => (diet[k]! += d));
      births += s.period.births;
    }
    const dtxt = deaths
      .map((d, k) => (d ? `${DEATH_CAUSES[k]}:${d}` : ''))
      .filter(Boolean)
      .join(' ');
    const total = diet.reduce((a, b) => a + b, 0) || 1;
    const ftxt = diet
      .map((d, k) => (d / total > 0.05 ? `${FOOD_KEYS[k]}:${Math.round((100 * d) / total)}%` : ''))
      .filter(Boolean)
      .join(' ');
    lines.push(
      `  sp${info.id} n=${last.count} ad=${last.adults} gen=${last.generationMean.toFixed(1)} mass=${last.massMean.toFixed(2)} speed=${last.speedMean.toFixed(3)} legs=${last.traitMean[T.LegLength]!.toFixed(2)} massT=${last.traitMean[T.Mass]!.toFixed(2)} litT=${last.traitMean[T.LitterSize]!.toFixed(2)} grT=${last.traitMean[T.Growth]!.toFixed(2)} cold=${last.traitMean[T.ColdTolerance]!.toFixed(2)} div=${last.diversity.toFixed(3)} inf=${last.infected} births=${births} | ${dtxt} | ${ftxt}`,
    );
  }
  console.log(`year ${y + 1} tick=${sim.tick} live=${sim.org.liveCount}\n${lines.join('\n')}`);
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(
  `seed=${values.seed} years=${years} hash=${hashToHex(sim.stateHash())} time=${(ms / 1000).toFixed(1)}s species=${sp}`,
);
