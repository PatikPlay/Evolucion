import type { SimConfig } from '../config';
import type { Climate } from './climate';
import { BIOME_PLANTS, type Terrain } from './terrain';
import { Season, seasonOf } from '../time';

export const enum Plant {
  Grass = 0,
  Shrub = 1,
  Tree = 2,
  Algae = 3,
}
export const PLANT_TYPES = 4;

/**
 * Per-cell plant biomass with logistic growth. Fruit is a separate seasonal
 * pool produced by shrubs and trees.
 */
export class Vegetation {
  readonly biomass: Float32Array[];
  readonly capacity: Float32Array[];
  /** Capacity multiplier bonus from sowing, per type. */
  readonly sown: Float32Array[];
  /** Growth multiplier per type (plant disease < 1). */
  readonly typeHealth = new Float32Array([1, 1, 1, 1]);
  readonly fruit: Float32Array;
  /** Thorny shrubs: protect small animals, hurt browsers. */
  readonly thorny: Uint8Array;
  private readonly rates: number[];
  private readonly baseK: number[];

  constructor(
    private readonly terrain: Terrain,
    private readonly cfg: SimConfig,
  ) {
    const n = terrain.size;
    this.biomass = [
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
    ];
    this.capacity = [
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
    ];
    this.sown = [
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
      new Float32Array(n),
    ];
    this.fruit = new Float32Array(n);
    this.thorny = new Uint8Array(n);
    const v = cfg.vegetation;
    this.rates = [v.growthRate.grass, v.growthRate.shrub, v.growthRate.tree, v.growthRate.algae];
    this.baseK = [v.capacity.grass, v.capacity.shrub, v.capacity.tree, v.capacity.algae];
    this.recomputeAllCapacity();
    // Start near equilibrium.
    for (let p = 0; p < PLANT_TYPES; p++) {
      const b = this.biomass[p] as Float32Array;
      const k = this.capacity[p] as Float32Array;
      for (let i = 0; i < n; i++) b[i] = (k[i] as number) * 0.8;
    }
  }

  recomputeAllCapacity(): void {
    for (let i = 0; i < this.terrain.size; i++) this.recomputeCapacity(i);
  }

  recomputeCapacity(i: number): void {
    const t = this.terrain;
    const mult = BIOME_PLANTS[t.biome[i] as number] as readonly number[];
    const moist = 0.35 + 0.65 * (t.moisture[i] as number);
    const fert = t.fertility[i] as number;
    for (let p = 0; p < PLANT_TYPES; p++) {
      const water = p === Plant.Algae;
      const k =
        (this.baseK[p] as number) *
        (mult[p] as number) *
        fert *
        (water ? 1 : moist) *
        (1 + ((this.sown[p] as Float32Array)[i] as number));
      (this.capacity[p] as Float32Array)[i] = k;
    }
  }

  /**
   * Yearly food-value estimate used to equalise parcels: what a generic
   * herbivore could extract per year (grass, browse, fruit; little canopy or
   * algae, which need special adaptations).
   */
  productivityEstimate(): number {
    const v = this.cfg.vegetation;
    // Peak of (B/K + rootStock)(1 − B/K): yield per unit r·K at the best grazing pressure.
    const MAX_YIELD = ((1 + v.rootStock) * (1 + v.rootStock)) / 4;
    const growTicks = 260;
    const fruitTicks = 200;
    let total = 0;
    const kG = this.capacity[0] as Float32Array;
    const kS = this.capacity[1] as Float32Array;
    const kT = this.capacity[2] as Float32Array;
    const kA = this.capacity[3] as Float32Array;
    for (let i = 0; i < kG.length; i++) {
      const g = kG[i] as number;
      const sh = kS[i] as number;
      const tr = kT[i] as number;
      const al = kA[i] as number;
      total += g * v.growthRate.grass * MAX_YIELD * growTicks * 0.3;
      total += sh * v.growthRate.shrub * MAX_YIELD * growTicks * 0.2;
      total += tr * v.growthRate.tree * MAX_YIELD * growTicks * 0.04;
      total += al * v.growthRate.algae * MAX_YIELD * growTicks * 0.05;
      // Fruit: produced by shrubs and trees in summer and autumn, partly lost to decay.
      total += v.fruitRate * 0.75 * (sh + 0.5 * tr) * fruitTicks * 0.5 * 1.4;
    }
    return total;
  }

  /** Grows the interleaved block of cells assigned to this tick. */
  update(tick: number, climate: Climate): void {
    const v = this.cfg.vegetation;
    const stride = v.updateStride;
    const t = this.terrain;
    const season = seasonOf(tick);
    const fruiting = season === Season.Summer || season === Season.Autumn;
    const offset = climate.offsetNow;
    for (let i = tick % stride; i < t.size; i += stride) {
      const temp = (t.baseTemp[i] as number) + offset;
      let gT = 0;
      if (temp > v.growMinTemp && temp < v.growMaxTemp) {
        gT =
          temp < v.growOptTemp
            ? (temp - v.growMinTemp) / (v.growOptTemp - v.growMinTemp)
            : 1 - (temp - v.growOptTemp) / (v.growMaxTemp - v.growOptTemp);
        gT = Math.max(0, Math.min(1, gT * 1.3));
      }
      const moist = Math.min(1.2, (t.moisture[i] as number) * climate.moistureNow);
      const g = gT * (0.25 + 0.75 * Math.min(1, moist / 0.6));
      const boost = 1 + (t.burnBoost[i] as number);
      for (let p = 0; p < PLANT_TYPES; p++) {
        const b = this.biomass[p] as Float32Array;
        const K = ((this.capacity[p] as Float32Array)[i] as number) * boost;
        let B = b[i] as number;
        if (K <= 0) {
          if (B > 0) b[i] = B * 0.9;
          continue;
        }
        const gp = p === 3 ? Math.max(0.2, gT) : g;
        const r = (this.rates[p] as number) * gp * (this.typeHealth[p] as number) * stride;
        if (B < 0.03 * K) B += v.reseed * K * stride * gp;
        // Regrowth draws on roots and seed banks, so grazed plants recover
        // even from very low standing biomass.
        B += r * (B + v.rootStock * K) * (1 - B / K);
        if (B > K) B -= (B - K) * 0.05 * stride;
        // Frost slowly kills soft plants.
        if (temp < -2 && p === 0) B *= 1 - 0.002 * stride;
        b[i] = B < 0 ? 0 : B;
      }
      let f = this.fruit[i] as number;
      if (fruiting) {
        f +=
          v.fruitRate *
          ((this.biomass[1] as Float32Array)[i]! + 0.5 * (this.biomass[2] as Float32Array)[i]!) *
          stride *
          g;
      }
      f -= v.fruitDecay * f * stride;
      this.fruit[i] = f > v.fruitMax ? v.fruitMax : f < 0 ? 0 : f;
      // Fire boost decays over a couple of years.
      const bb = t.burnBoost[i] as number;
      if (bb > 0) t.burnBoost[i] = bb < 0.01 ? 0 : bb * (1 - 0.0012 * stride);
    }
  }

  /** Total biomass of a plant type in the parcel. */
  total(p: Plant): number {
    const b = this.biomass[p] as Float32Array;
    let s = 0;
    for (let i = 0; i < b.length; i++) s += b[i] as number;
    return s;
  }
}
