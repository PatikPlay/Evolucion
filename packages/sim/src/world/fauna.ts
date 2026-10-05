import type { SimConfig } from '../config';
import { isWater, type Terrain } from './terrain';
import type { Vegetation } from './vegetation';

export const enum FaunaKind {
  Insects = 0,
  SmallHerbivores = 1,
  Fish = 2,
}
export const FAUNA_KINDS = 3;

/**
 * Background NPC fauna as density fields over blocks of cells. It feeds
 * insectivores, small-prey hunters and fishers, and closes the food chain
 * without simulating individuals.
 */
export class Fauna {
  readonly blockSize: number;
  readonly bw: number;
  readonly bh: number;
  /** Biomass (fu) per block, per kind. */
  readonly density: Float32Array[];
  /** Capacity multipliers per kind (introduced prey raise them; plagues spike insects). */
  readonly boost = new Float32Array([1, 1, 1]);
  private readonly waterCells: Uint16Array;
  private readonly cellsPerBlock: number;

  constructor(
    private readonly terrain: Terrain,
    private readonly veg: Vegetation,
    private readonly cfg: SimConfig,
  ) {
    this.blockSize = cfg.fauna.blockSize;
    this.bw = Math.ceil(terrain.width / this.blockSize);
    this.bh = Math.ceil(terrain.height / this.blockSize);
    const nb = this.bw * this.bh;
    this.density = [new Float32Array(nb), new Float32Array(nb), new Float32Array(nb)];
    this.waterCells = new Uint16Array(nb);
    this.cellsPerBlock = this.blockSize * this.blockSize;
    this.recountWater();
    for (let b = 0; b < nb; b++) {
      for (let k = 0; k < FAUNA_KINDS; k++) (this.density[k] as Float32Array)[b] = this.capacityOf(k, b) * 0.7;
    }
  }

  recountWater(): void {
    this.waterCells.fill(0);
    const t = this.terrain;
    for (let i = 0; i < t.size; i++) {
      if (isWater(t.biome[i] as number)) this.waterCells[this.blockOfCell(i)]! += 1;
    }
  }

  blockOfCell(i: number): number {
    const x = i % this.terrain.width;
    const y = (i - x) / this.terrain.width;
    return Math.floor(y / this.blockSize) * this.bw + Math.floor(x / this.blockSize);
  }

  blockAt(x: number, y: number): number {
    const bx = Math.min(this.bw - 1, Math.max(0, Math.floor(x / this.blockSize)));
    const by = Math.min(this.bh - 1, Math.max(0, Math.floor(y / this.blockSize)));
    return by * this.bw + bx;
  }

  private plantSums(b: number): [number, number] {
    const bx = (b % this.bw) * this.blockSize;
    const by = Math.floor(b / this.bw) * this.blockSize;
    const w = this.terrain.width;
    let grass = 0;
    let shrub = 0;
    const g = this.veg.biomass[0] as Float32Array;
    const s = this.veg.biomass[1] as Float32Array;
    for (let y = by; y < Math.min(by + this.blockSize, this.terrain.height); y++) {
      for (let x = bx; x < Math.min(bx + this.blockSize, w); x++) {
        grass += g[y * w + x] as number;
        shrub += s[y * w + x] as number;
      }
    }
    return [grass, shrub];
  }

  capacityOf(kind: number, b: number): number {
    const f = this.cfg.fauna;
    if (kind === FaunaKind.Fish) return (this.waterCells[b] as number) * f.fishCapacityPerWaterCell * (this.boost[2] as number);
    const [grass, shrub] = this.plantSums(b);
    if (kind === FaunaKind.Insects) return (grass + shrub) * f.insectCapacityPerPlant * (this.boost[0] as number);
    return grass * f.smallHerbCapacityPerGrass * (this.boost[1] as number);
  }

  update(tick: number): void {
    const f = this.cfg.fauna;
    if (tick % f.updateStride !== 0) return;
    const rates = [f.insectGrowth, f.smallHerbGrowth, f.fishGrowth];
    const nb = this.bw * this.bh;
    const grassArr = this.veg.biomass[0] as Float32Array;
    for (let b = 0; b < nb; b++) {
      for (let k = 0; k < FAUNA_KINDS; k++) {
        const d = this.density[k] as Float32Array;
        const K = this.capacityOf(k, b);
        let D = d[b] as number;
        if (K <= 0) {
          d[b] = D * 0.8;
          continue;
        }
        if (D < 0.02 * K) D += 0.002 * K * f.updateStride;
        D += (rates[k] as number) * f.updateStride * D * (1 - D / K);
        d[b] = D < 0 ? 0 : D;
      }
      // Insects graze: negligible normally, devastating in plagues.
      const ins = (this.density[0] as Float32Array)[b] as number;
      if (ins > 0 && (this.boost[0] as number) > 1.5) {
        const graze = ins * f.insectGrazing * f.updateStride;
        const bx = (b % this.bw) * this.blockSize;
        const by = Math.floor(b / this.bw) * this.blockSize;
        const w = this.terrain.width;
        const per = graze / this.cellsPerBlock;
        for (let y = by; y < Math.min(by + this.blockSize, this.terrain.height); y++) {
          for (let x = bx; x < Math.min(bx + this.blockSize, w); x++) {
            const i = y * w + x;
            grassArr[i] = Math.max(0, (grassArr[i] as number) - per);
          }
        }
      }
    }
  }

  /** Removes up to `amount` fu of a kind at a position; returns what was taken. */
  take(kind: FaunaKind, x: number, y: number, amount: number): number {
    const d = this.density[kind] as Float32Array;
    const b = this.blockAt(x, y);
    const avail = d[b] as number;
    const got = Math.min(avail, amount);
    d[b] = avail - got;
    return got;
  }

  densityAt(kind: FaunaKind, x: number, y: number): number {
    return (this.density[kind] as Float32Array)[this.blockAt(x, y)] as number;
  }

  total(kind: FaunaKind): number {
    const d = this.density[kind] as Float32Array;
    let s = 0;
    for (let i = 0; i < d.length; i++) s += d[i] as number;
    return s;
  }
}
