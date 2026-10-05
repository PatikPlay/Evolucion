import { FaunaKind, Plant, type ParcelSim } from '@linaje/sim';
import { encodeFauna, encodeTerrain, encodeVegetation } from '@linaje/protocol';

/** Visual scale (fu) at which a plant layer looks "full". Fixed, so clients see absolute abundance. */
const PLANT_SCALE = [12, 14, 40, 12];
const FRUIT_SCALE = 4;
const FAUNA_SCALE = [12, 8, 14];

function q255(v: number, scale: number): number {
  const q = Math.round((v / scale) * 255);
  return q < 0 ? 0 : q > 255 ? 255 : q;
}

export function encodeTerrainView(sim: ParcelSim, parcel: number): ArrayBuffer {
  const t = sim.world.terrain;
  const elevation = new Uint8Array(t.size);
  const marks = new Uint8Array(t.size);
  for (let c = 0; c < t.size; c++) {
    elevation[c] = q255(t.elevation[c] as number, 1);
    marks[c] =
      (t.refuge[c] ? 1 : 0) | ((t.burrow[c] as number) > 0.3 ? 2 : 0) | (t.enclosure[c] ? 4 : 0);
  }
  return encodeTerrain({
    parcel,
    width: t.width,
    height: t.height,
    biome: t.biome.slice(),
    elevation,
    barrier: t.barrier.slice(),
    marks,
  });
}

export function encodeVegetationView(sim: ParcelSim, parcel: number): ArrayBuffer {
  const t = sim.world.terrain;
  const v = sim.world.vegetation;
  const layer = (p: Plant) => {
    const b = v.biomass[p] as Float32Array;
    const out = new Uint8Array(t.size);
    for (let c = 0; c < t.size; c++) out[c] = q255(b[c] as number, PLANT_SCALE[p] as number);
    return out;
  };
  const fruit = new Uint8Array(t.size);
  for (let c = 0; c < t.size; c++) fruit[c] = q255(v.fruit[c] as number, FRUIT_SCALE);
  return encodeVegetation({
    parcel,
    tick: sim.tick,
    width: t.width,
    height: t.height,
    grass: layer(Plant.Grass),
    shrub: layer(Plant.Shrub),
    tree: layer(Plant.Tree),
    algae: layer(Plant.Algae),
    fruit,
  });
}

export function encodeFaunaView(sim: ParcelSim, parcel: number): ArrayBuffer {
  const f = sim.world.fauna;
  const layer = (k: FaunaKind) => {
    const d = f.density[k] as Float32Array;
    const out = new Uint8Array(d.length);
    for (let b = 0; b < d.length; b++) out[b] = q255(d[b] as number, FAUNA_SCALE[k] as number);
    return out;
  };
  return encodeFauna({
    parcel,
    tick: sim.tick,
    blockSize: f.blockSize,
    bw: f.bw,
    bh: f.bh,
    insects: layer(FaunaKind.Insects),
    small: layer(FaunaKind.SmallHerbivores),
    fish: layer(FaunaKind.Fish),
  });
}
