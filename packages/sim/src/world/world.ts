import type { SimConfig } from '../config';
import type { Rng } from '../rng';
import { TerrainAccess } from './access';
import { Carcasses } from './carcasses';
import { Climate } from './climate';
import { Fauna } from './fauna';
import { generateTerrain, type Terrain } from './terrain';
import { PLANT_TYPES, Vegetation } from './vegetation';

/** Everything in a parcel that is not an organism. */
export class World {
  readonly terrain: Terrain;
  readonly climate: Climate;
  readonly vegetation: Vegetation;
  readonly fauna: Fauna;
  readonly carcasses: Carcasses;
  readonly access: TerrainAccess;

  constructor(terrain: Terrain, cfg: SimConfig) {
    this.terrain = terrain;
    this.climate = new Climate(cfg);
    this.vegetation = new Vegetation(terrain, cfg);
    this.fauna = new Fauna(terrain, this.vegetation, cfg);
    this.carcasses = new Carcasses();
    this.access = new TerrainAccess(terrain);
  }

  update(tick: number, cfg: SimConfig): void {
    this.climate.update(tick);
    this.vegetation.update(tick, this.climate);
    this.fauna.update(tick);
    this.carcasses.update(cfg.predation.carcassDecay);
  }

  /** Recomputes derived layers after a terrain edit (water, shelters, capacity). */
  terrainChanged(): void {
    this.vegetation.recomputeAllCapacity();
    this.fauna.recountWater();
    this.access.rebuildWater();
    this.access.rebuildShelter();
  }
}

/**
 * Generates a parcel world and scales its fertility so the yearly plant
 * productivity matches the target: every parcel has equivalent capacity.
 */
export function createWorld(rng: Rng, cfg: SimConfig): World {
  const terrain = generateTerrain(rng.fork('terrain'), cfg);
  const world = new World(terrain, cfg);
  const target = cfg.world.targetProductivityPerCell * terrain.size;
  for (let pass = 0; pass < 2; pass++) {
    const est = world.vegetation.productivityEstimate();
    const scale = target / est;
    for (let i = 0; i < terrain.size; i++) terrain.fertility[i] = (terrain.fertility[i] as number) * scale;
    world.vegetation.recomputeAllCapacity();
  }
  for (let p = 0; p < PLANT_TYPES; p++) {
    const b = world.vegetation.biomass[p] as Float32Array;
    const k = world.vegetation.capacity[p] as Float32Array;
    for (let i = 0; i < b.length; i++) b[i] = (k[i] as number) * 0.8;
  }
  return world;
}
