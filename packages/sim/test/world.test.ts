import { describe, expect, it } from 'vitest';
import { DEFAULT_SIM_CONFIG, mergeConfig } from '../src/config';
import { Rng } from '../src/rng';
import { Biome, BIOME_COUNT } from '../src/world/terrain';
import { createWorld } from '../src/world/world';
import { TICKS_PER_YEAR } from '../src/time';
import { Plant } from '../src/world/vegetation';

describe('world generation', () => {
  it('is deterministic per seed', () => {
    const a = createWorld(new Rng('w1'), DEFAULT_SIM_CONFIG);
    const b = createWorld(new Rng('w1'), DEFAULT_SIM_CONFIG);
    expect(Array.from(a.terrain.biome)).toEqual(Array.from(b.terrain.biome));
    const c = createWorld(new Rng('w2'), DEFAULT_SIM_CONFIG);
    expect(Array.from(a.terrain.biome)).not.toEqual(Array.from(c.terrain.biome));
  });

  it('produces varied biomes with water and drinkable access', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const w = createWorld(new Rng(seed), DEFAULT_SIM_CONFIG);
      const counts = new Array<number>(BIOME_COUNT).fill(0);
      for (let i = 0; i < w.terrain.size; i++) counts[w.terrain.biome[i] as number]! += 1;
      const water = counts[Biome.ShallowWater]! + counts[Biome.DeepWater]!;
      expect(water / w.terrain.size).toBeGreaterThan(0.05);
      expect(water / w.terrain.size).toBeLessThan(0.25);
      // At least four land biomes present.
      const land = [Biome.Grassland, Biome.Forest, Biome.Shrubland, Biome.Sand, Biome.Rock].filter((b) => counts[b]! > 20);
      expect(land.length).toBeGreaterThanOrEqual(4);
      // No land cell is unreasonably far from water.
      let far = 0;
      for (let i = 0; i < w.terrain.size; i++) if ((w.access.waterDistance[i] as number) > 45) far++;
      expect(far / w.terrain.size).toBeLessThan(0.05);
    }
  });

  it('gives every parcel the same ecological capacity within ±10%', () => {
    const values: number[] = [];
    for (let s = 0; s < 12; s++) values.push(createWorld(new Rng(`cap-${s}`), DEFAULT_SIM_CONFIG).vegetation.productivityEstimate());
    const target = DEFAULT_SIM_CONFIG.world.targetProductivityPerCell * 96 * 96;
    for (const v of values) expect(Math.abs(v / target - 1)).toBeLessThan(0.1);
  });

  it('vegetation stays bounded and follows the seasons', () => {
    const cfg = mergeConfig();
    const w = createWorld(new Rng('veg'), cfg);
    let springGrass = 0;
    let winterGrass = 0;
    for (let tick = 0; tick < TICKS_PER_YEAR * 2; tick++) {
      w.update(tick, cfg);
      if (tick === TICKS_PER_YEAR + 90) springGrass = w.vegetation.total(Plant.Grass);
      if (tick === TICKS_PER_YEAR + 390) winterGrass = w.vegetation.total(Plant.Grass);
    }
    for (let p = 0; p < 4; p++) {
      const b = w.vegetation.biomass[p] as Float32Array;
      const k = w.vegetation.capacity[p] as Float32Array;
      for (let i = 0; i < b.length; i++) {
        expect(Number.isFinite(b[i])).toBe(true);
        expect(b[i]).toBeLessThanOrEqual((k[i] as number) * 1.05 + 1e-3);
      }
    }
    expect(springGrass).toBeGreaterThan(0);
    expect(winterGrass).toBeGreaterThan(0);
    expect(w.fauna.total(0)).toBeGreaterThan(0);
  });
});
