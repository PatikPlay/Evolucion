/**
 * H1 acceptance: the population stabilises without artificial caps, and there
 * are neither NaNs nor memory growth over 50 generations.
 */
import { describe, expect, it } from 'vitest';
import { ParcelSim, TICKS_PER_YEAR, TRAIT_COUNT, DERIVED_COUNT } from '../src/index';

function assertFinite(sim: ParcelSim): void {
  const o = sim.org;
  for (let i = 0; i < o.high; i++) {
    if (!o.alive[i]) continue;
    for (const arr of [o.x, o.y, o.energy, o.hydration, o.health, o.mass, o.fatigue]) {
      if (!Number.isFinite(arr[i])) throw new Error(`non-finite value for organism ${i}`);
    }
    for (let t = 0; t < TRAIT_COUNT; t++)
      if (!Number.isFinite(o.pheno[i * TRAIT_COUNT + t])) throw new Error(`NaN trait ${t}`);
    for (let d = 0; d < DERIVED_COUNT; d++)
      if (!Number.isFinite(o.derived[i * DERIVED_COUNT + d])) throw new Error(`NaN derived ${d}`);
  }
  for (const b of sim.world.vegetation.biomass)
    for (let c = 0; c < b.length; c++)
      if (!Number.isFinite(b[c])) throw new Error('NaN vegetation');
}

describe('long-run stability (H1)', () => {
  it('runs 50 generations with a bounded, persistent population and no NaN or memory growth', () => {
    const sim = new ParcelSim({ seed: 'stability' });
    // Long runs only keep recent hidden samples in memory.
    sim.stats.maxSamples = 2000;
    const species = sim.spawnFounders({ key: 'base', traits: {} }, 40, 0);
    const counts: number[] = [];
    const capacities: number[] = [];
    let heapMid = 0;
    let year = 0;
    while (year < 80) {
      sim.run(TICKS_PER_YEAR);
      year++;
      assertFinite(sim);
      counts.push(sim.count({ species }));
      capacities.push(sim.org.capacity);
      if (year === 40) {
        globalThis.gc?.();
        heapMid = process.memoryUsage().heapUsed;
      }
      const gen = sim.stats.latest(species)?.generationMean ?? 0;
      if (gen >= 50 && year > 40) break;
    }
    const gen = sim.stats.latest(species)?.generationMean ?? 0;
    console.log(
      `years=${year} generations=${gen.toFixed(1)} population by year: ${counts.join(' ')}`,
    );
    expect(gen).toBeGreaterThanOrEqual(50);
    // Persistent and stabilised: never extinct; the last decade oscillates within a band.
    expect(Math.min(...counts.slice(5))).toBeGreaterThan(0);
    const late = counts.slice(-10);
    const mean = late.reduce((a, b) => a + b, 0) / late.length;
    for (const c of late) expect(Math.abs(c - mean)).toBeLessThan(mean * 0.3);
    // Memory follows the population, not the passage of time: storage is at
    // most the next power of two above the largest population ever reached.
    const peak = Math.max(...counts);
    expect(sim.org.capacity).toBeLessThanOrEqual(
      Math.max(2048, 2 ** Math.ceil(Math.log2(peak * 1.1))),
    );
    globalThis.gc?.();
    const heapEnd = process.memoryUsage().heapUsed;
    if (heapMid > 0) expect(heapEnd).toBeLessThan(heapMid * 1.5 + 50e6);
  });
});
