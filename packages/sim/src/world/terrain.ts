import type { Rng } from '../rng';
import type { SimConfig } from '../config';
import { clamp01 } from '../math';
import { ValueNoise2D } from './noise';

export const enum Biome {
  Grassland = 0,
  Forest = 1,
  Shrubland = 2,
  Sand = 3,
  Rock = 4,
  ShallowWater = 5,
  DeepWater = 6,
}

export const BIOME_COUNT = 7;

export const BIOME_NAMES = ['grassland', 'forest', 'shrubland', 'sand', 'rock', 'shallow', 'deep'] as const;

/** Plant capacity multipliers per biome: [grass, shrub, tree, algae]. */
export const BIOME_PLANTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1.0, 0.15, 0.04, 0], // grassland
  [0.25, 0.35, 1.0, 0], // forest
  [0.5, 0.85, 0.1, 0], // shrubland
  [0.12, 0.15, 0, 0], // sand
  [0.08, 0.06, 0.02, 0], // rock
  [0, 0, 0, 1.0], // shallow water
  [0, 0, 0, 0.55], // deep water
];

/** Base hiding cover per biome (vegetation and refuges add to it). */
export const BIOME_COVER = [0.12, 0.7, 0.45, 0.04, 0.5, 0.1, 0] as const;

/** Movement speed multiplier per biome for a walker. */
export const BIOME_MOVE = [1, 0.85, 0.9, 0.85, 0.75, 0.45, 0.3] as const;

export const enum Barrier {
  None = 0,
  Hedge = 1,
  Trench = 2,
}

export function isWater(b: number): boolean {
  return b === Biome.ShallowWater || b === Biome.DeepWater;
}

/**
 * Static and slowly changing per-cell data of a parcel. Dynamic plant biomass
 * lives in Vegetation; background fauna in Fauna.
 */
export class Terrain {
  readonly width: number;
  readonly height: number;
  readonly size: number;
  readonly biome: Uint8Array;
  readonly elevation: Float32Array;
  readonly moisture: Float32Array;
  readonly fertility: Float32Array;
  readonly baseTemp: Float32Array;
  /** Player/event modifications. */
  readonly barrier: Uint8Array;
  readonly refuge: Uint8Array;
  /** Burrow quality in [0,1], dug by excavators; decays slowly. */
  readonly burrow: Float32Array;
  /** Temporary fertility boost after fire, decays to 0. */
  readonly burnBoost: Float32Array;
  /** Experiment enclosures: 0 = none, otherwise enclosure id. */
  readonly enclosure: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.biome = new Uint8Array(this.size);
    this.elevation = new Float32Array(this.size);
    this.moisture = new Float32Array(this.size);
    this.fertility = new Float32Array(this.size);
    this.baseTemp = new Float32Array(this.size);
    this.barrier = new Uint8Array(this.size);
    this.refuge = new Uint8Array(this.size);
    this.burrow = new Float32Array(this.size);
    this.burnBoost = new Float32Array(this.size);
    this.enclosure = new Uint8Array(this.size);
  }

  index(x: number, y: number): number {
    let cx = Math.floor(x);
    let cy = Math.floor(y);
    if (cx < 0) cx = 0;
    else if (cx >= this.width) cx = this.width - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.height) cy = this.height - 1;
    return cy * this.width + cx;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  countBiome(b: Biome): number {
    let n = 0;
    for (let i = 0; i < this.size; i++) if (this.biome[i] === b) n++;
    return n;
  }
}

/** Generates a parcel's terrain. Pure function of the rng stream and config. */
export function generateTerrain(rng: Rng, cfg: SimConfig): Terrain {
  const { width: w, height: h } = cfg.world;
  const t = new Terrain(w, h);
  const elevNoise = new ValueNoise2D(rng.fork('elevation'));
  const moistNoise = new ValueNoise2D(rng.fork('moisture'));
  const detailNoise = new ValueNoise2D(rng.fork('detail'));
  const tiltAngle = rng.float() * Math.PI * 2;
  const tiltX = Math.cos(tiltAngle);
  const tiltY = Math.sin(tiltAngle);
  const scale = 26 + rng.float() * 10;

  // Elevation: fractal noise plus a gentle tilt so water gathers on one side.
  let emin = Infinity;
  let emax = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / w - 0.5;
      const ny = y / h - 0.5;
      const e = elevNoise.fbm(x / scale, y / scale, 4) + 0.35 * (nx * tiltX + ny * tiltY);
      const i = y * w + x;
      t.elevation[i] = e;
      if (e < emin) emin = e;
      if (e > emax) emax = e;
    }
  }
  for (let i = 0; i < t.size; i++) t.elevation[i] = ((t.elevation[i] as number) - emin) / (emax - emin);

  // Lakes: the lowest cells.
  const isWaterCell = new Uint8Array(t.size);
  const sorted = Array.from(t.elevation).sort((a, b) => a - b);
  const lakeFraction = cfg.world.waterFraction * 0.62;
  const lakeLevel = sorted[Math.floor(lakeFraction * t.size)] as number;
  const deepLevel = sorted[Math.floor(lakeFraction * cfg.world.deepFraction * 1.6 * t.size)] as number;
  for (let i = 0; i < t.size; i++) {
    const e = t.elevation[i] as number;
    if (e < lakeLevel) {
      isWaterCell[i] = e < deepLevel ? 2 : 1;
    }
  }

  // River: walks downhill from a high cell towards the lake.
  if (rng.chance(cfg.world.riverChance)) carveRiver(t, isWaterCell, rng.fork('river'));

  // Ponds: small shallow water bodies, placed far from existing water so no
  // region of the parcel is left without a place to drink.
  const ponds = rng.intRange(cfg.world.minPonds, cfg.world.maxPonds);
  const pondRng = rng.fork('ponds');
  for (let p = 0; p < ponds; p++) {
    const dist = distanceField(isWaterCell, w, h);
    let bestI = -1;
    let bestD = -1;
    for (let k = 0; k < 40; k++) {
      const cx = 5 + pondRng.int(w - 10);
      const cy = 5 + pondRng.int(h - 10);
      const d = (dist[cy * w + cx] as number) + pondRng.float() * 6;
      if (d > bestD) {
        bestD = d;
        bestI = cy * w + cx;
      }
    }
    if (bestI < 0) continue;
    const px = (bestI % w) + 0.5;
    const py = Math.floor(bestI / w) + 0.5;
    const r = 1.4 + pondRng.float() * 1.6;
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        if (dx * dx + dy * dy <= r * r) isWaterCell[y * w + x] = Math.max(isWaterCell[y * w + x] as number, 1);
      }
    }
  }

  // Moisture: noise plus proximity to water.
  const waterDist = distanceField(isWaterCell, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const n = moistNoise.fbm(x / 22 + 40, y / 22 + 13, 3);
      const near = Math.exp(-(waterDist[i] as number) / 10);
      t.moisture[i] = clamp01(0.15 + 0.75 * n + 0.35 * near - 0.15 * (t.elevation[i] as number));
    }
  }

  // Biomes.
  let landMax = 0;
  for (let i = 0; i < t.size; i++) if (!isWaterCell[i]) landMax = Math.max(landMax, t.elevation[i] as number);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const water = isWaterCell[i] as number;
      if (water === 2) {
        t.biome[i] = Biome.DeepWater;
        continue;
      }
      if (water === 1) {
        t.biome[i] = Biome.ShallowWater;
        continue;
      }
      const e = (t.elevation[i] as number) / landMax;
      const m = t.moisture[i] as number;
      const d = detailNoise.fbm(x / 7, y / 7, 2);
      if (e > 0.86 + 0.08 * (d - 0.5)) t.biome[i] = Biome.Rock;
      else if (m < 0.27 + 0.08 * (d - 0.5)) t.biome[i] = Biome.Sand;
      else if (m > 0.6 + 0.1 * (d - 0.5)) t.biome[i] = Biome.Forest;
      else if (m > 0.44 + 0.12 * (d - 0.5)) t.biome[i] = Biome.Shrubland;
      else t.biome[i] = Biome.Grassland;
    }
  }

  // Fertility and temperature.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const n = detailNoise.fbm(x / 13 + 70, y / 13 + 9, 2);
      t.fertility[i] = 0.7 + 0.6 * n;
      const landElev = isWaterCell[i] ? 0 : Math.max(0, ((t.elevation[i] as number) - lakeLevel) / (1 - lakeLevel));
      t.baseTemp[i] = cfg.climate.baseTemperature - cfg.climate.elevationCooling * landElev;
    }
  }
  return t;
}

function carveRiver(t: Terrain, water: Uint8Array, rng: Rng): void {
  const { width: w, height: h } = t;
  // Start on a high cell near an edge.
  let best = -1;
  let bestScore = -Infinity;
  for (let k = 0; k < 60; k++) {
    const edge = rng.int(4);
    const along = 4 + rng.int((edge < 2 ? w : h) - 8);
    const x = edge === 0 ? along : edge === 1 ? along : edge === 2 ? 2 : w - 3;
    const y = edge === 0 ? 2 : edge === 1 ? h - 3 : along;
    const i = y * w + x;
    const s = (t.elevation[i] as number) + rng.float() * 0.1;
    if (!water[i] && s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  if (best < 0) return;
  // Target: centroid of the deepest water.
  let tx = 0;
  let ty = 0;
  let n = 0;
  for (let i = 0; i < t.size; i++) {
    if (water[i]) {
      tx += i % w;
      ty += Math.floor(i / w);
      n++;
    }
  }
  if (n === 0) return;
  tx /= n;
  ty /= n;
  let x = best % w;
  let y = Math.floor(best / w);
  const visited = new Set<number>();
  for (let step = 0; step < 400; step++) {
    const i = y * w + x;
    if (water[i] && step > 3) break;
    water[i] = Math.max(water[i] as number, 1);
    visited.add(i);
    if (step % 3 === 0) {
      // Occasionally widen the river.
      const sx = x + (rng.chance(0.5) ? 1 : -1);
      if (sx >= 0 && sx < w) water[y * w + sx] = Math.max(water[y * w + sx] as number, 1);
    }
    let bx = x;
    let by = y;
    let bs = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (visited.has(ni)) continue;
        const dist = Math.hypot(nx - tx, ny - ty);
        const s = (t.elevation[ni] as number) * 2 + dist * 0.03 + rng.float() * 0.08;
        if (s < bs) {
          bs = s;
          bx = nx;
          by = ny;
        }
      }
    }
    if (bs === Infinity) break;
    x = bx;
    y = by;
  }
}

/** Chebyshev-ish BFS distance (in cells) from any non-zero cell of `sources`. */
export function distanceField(sources: Uint8Array, w: number, h: number): Float32Array {
  const dist = new Float32Array(w * h).fill(Infinity);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < w * h; i++) {
    if (sources[i]) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++] as number;
    const x = i % w;
    const y = (i - x) / w;
    const d = (dist[i] as number) + 1;
    if (x > 0 && (dist[i - 1] as number) > d) {
      dist[i - 1] = d;
      queue[tail++] = i - 1;
    }
    if (x < w - 1 && (dist[i + 1] as number) > d) {
      dist[i + 1] = d;
      queue[tail++] = i + 1;
    }
    if (y > 0 && (dist[i - w] as number) > d) {
      dist[i - w] = d;
      queue[tail++] = i - w;
    }
    if (y < h - 1 && (dist[i + w] as number) > d) {
      dist[i + w] = d;
      queue[tail++] = i + w;
    }
  }
  return dist;
}
