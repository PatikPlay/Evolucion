/** Debug: traces a few organisms tick by tick. `tsx packages/sim/scripts/trace.ts seed ticks`. */
import { ParcelSim, ACT_KEYS, D } from '../src/index';
const sim = new ParcelSim({ seed: process.argv[2] ?? 'trace' });
sim.spawnFounders({ key: 'base', traits: {} }, 30, 0);
const ticks = Number(process.argv[3] ?? 200);
const watch = [0, 1, 2];
for (let t = 0; t < ticks; t++) {
  sim.step();
  if (t % 10 !== 0) continue;
  const parts = watch.map((i) => {
    const o = sim.org;
    if (!o.alive[i]) return `#${i} dead`;
    return `#${i} ${ACT_KEYS[o.action[i]!]} e=${(o.energy[i]! / sim.der(i, D.MaxEnergy)).toFixed(2)} h=${o.hydration[i]!.toFixed(2)} hp=${o.health[i]!.toFixed(2)} sp=${o.speed[i]!.toFixed(3)} m=${o.mass[i]!.toFixed(1)} th=${o.thermal[i]!.toFixed(2)}`;
  });
  console.log(`t=${t} live=${sim.org.liveCount} ${parts.join(' | ')}`);
}
const i = 0;
console.log('maxE', sim.der(i, D.MaxEnergy), 'm075', sim.der(i, D.M075), 'upkeep', sim.der(i, D.UpkeepMult), 'metab', sim.der(i, D.MetabolicRate), 'maxSpeed', sim.der(i, D.MaxSpeed), 'effGrass', sim.der(i, D.EffGrass), 'comfort', sim.der(i, D.ComfortLow), sim.der(i, D.ComfortHigh), 'maturity', sim.der(i, D.Maturity), 'life', sim.der(i, D.Lifespan));
