import { BIOME_COVER, Biome, isWater, type Terrain } from './terrain';

/**
 * Precomputed navigation helpers: for every cell, the nearest cell where an
 * organism can drink and the nearest sheltered cell. Rebuilt when terrain changes.
 */
export class TerrainAccess {
  /** Index of the nearest drinkable cell (land next to water, or shallow water). */
  readonly nearestWater: Int32Array;
  readonly waterDistance: Float32Array;
  /** Index of the nearest shelter cell (dense cover, refuge or burrow). */
  readonly nearestShelter: Int32Array;
  readonly shelterDistance: Float32Array;
  /** 1 if an organism standing here can drink. */
  readonly drinkable: Uint8Array;

  constructor(private readonly t: Terrain) {
    this.nearestWater = new Int32Array(t.size);
    this.waterDistance = new Float32Array(t.size);
    this.nearestShelter = new Int32Array(t.size);
    this.shelterDistance = new Float32Array(t.size);
    this.drinkable = new Uint8Array(t.size);
    this.rebuildWater();
    this.rebuildShelter();
  }

  rebuildWater(): void {
    const t = this.t;
    const w = t.width;
    const src = new Uint8Array(t.size);
    for (let i = 0; i < t.size; i++) {
      const b = t.biome[i] as number;
      if (b === Biome.ShallowWater) {
        src[i] = 1;
        continue;
      }
      if (b === Biome.DeepWater) continue;
      const x = i % w;
      const y = (i - x) / w;
      if (
        (x > 0 && isWater(t.biome[i - 1] as number)) ||
        (x < w - 1 && isWater(t.biome[i + 1] as number)) ||
        (y > 0 && isWater(t.biome[i - w] as number)) ||
        (y < t.height - 1 && isWater(t.biome[i + w] as number))
      ) {
        src[i] = 1;
      }
    }
    this.drinkable.set(src);
    nearestSource(src, w, t.height, this.nearestWater, this.waterDistance);
  }

  rebuildShelter(): void {
    const t = this.t;
    const src = new Uint8Array(t.size);
    for (let i = 0; i < t.size; i++) {
      if ((BIOME_COVER[t.biome[i] as number] as number) >= 0.45 || t.refuge[i] || (t.burrow[i] as number) > 0.3) src[i] = 1;
    }
    nearestSource(src, t.width, t.height, this.nearestShelter, this.shelterDistance);
  }
}

/** Multi-source BFS storing, for every cell, the nearest source index and its distance. */
export function nearestSource(src: Uint8Array, w: number, h: number, nearest: Int32Array, distance: Float32Array): void {
  const n = w * h;
  nearest.fill(-1);
  distance.fill(Infinity);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (src[i]) {
      nearest[i] = i;
      distance[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++] as number;
    const x = i % w;
    const y = (i - x) / w;
    const d = (distance[i] as number) + 1;
    const s = nearest[i] as number;
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x - 1 : k === 1 ? x + 1 : x;
      const ny = k === 2 ? y - 1 : k === 3 ? y + 1 : y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if ((distance[ni] as number) > d) {
        distance[ni] = d;
        nearest[ni] = s;
        queue[tail++] = ni;
      }
    }
  }
}
