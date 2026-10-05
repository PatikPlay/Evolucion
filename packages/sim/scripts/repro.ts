/** Debug: reproduction funnel. */
import { ParcelSim, D, TICKS_PER_YEAR, Flag } from '../src/index';
const sim = new ParcelSim({ seed: process.argv[2] ?? 's1' });
sim.spawnFounders({ key: 'base', traits: {} }, 30, 0);
for (let y = 0; y < Number(process.argv[3] ?? 4); y++) {
  const acts = new Map<number, number>();
  let femEnergy = 0, fem = 0, receptiveF = 0, pregnant = 0;
  for (let t = 0; t < TICKS_PER_YEAR; t++) {
    sim.step();
    if (t % 20 !== 0) continue;
    for (const i of sim.living()) {
      acts.set(sim.org.action[i]!, (acts.get(sim.org.action[i]!) ?? 0) + 1);
      if (sim.org.sex[i] === 0 && sim.isAdult(i)) {
        fem++;
        const f = sim.org.energy[i]! / sim.der(i, D.MaxEnergy);
        femEnergy += f;
        if (f > 0.55) receptiveF++;
        if (sim.org.flags[i]! & Flag.Pregnant) pregnant++;
      }
    }
  }
  const recent = sim.stats.samples.filter((s) => s.tick > sim.tick - TICKS_PER_YEAR);
  const matings = recent.reduce((a, s) => a + s.period.matings, 0);
  const lost = recent.reduce((a, s) => a + s.period.littersLost, 0);
  const births = recent.reduce((a, s) => a + s.period.births, 0);
  const names = ['rest','explore','graze','drink','flee','hunt','forage','scavenge','court','group','defend','care','hide','dig','store','migrate','sleep','hibernate','fight'];
  const total = [...acts.values()].reduce((a, b) => a + b, 0);
  console.log(`year ${y + 1}: n=${sim.org.liveCount} matings=${matings} births=${births} lost=${lost} femE=${(femEnergy / fem).toFixed(2)} receptive=${(receptiveF / fem).toFixed(2)} pregnant=${(pregnant / fem).toFixed(2)}`);
  console.log('   ' + [...acts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${names[k]}:${Math.round((100 * v) / total)}%`).join(' '));
}
