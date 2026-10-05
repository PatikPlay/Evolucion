import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { CAPABILITIES, CAPABILITY_COUNT } from '../organisms/capabilities';
import { TRAIT_COUNT } from '../genetics/traits';
import { ALLELES_PER_GENOME, LOCI } from '../genetics/genome-map';
import { DEATH_COUNT, FOOD_COUNT } from '../behavior/actions';

/** Event counters accumulated between two samples. */
export interface PeriodCounters {
  births: number;
  matings: number;
  littersLost: number;
  deaths: number[];
  /** Sum of the mass (relative to the species mean at the time) of the dead, per cause. */
  deathRelMass: number[];
  /** Sum of the age fraction (age / lifespan) of the dead, per cause. */
  deathAgeFrac: number[];
  /** Energy obtained per food type. */
  diet: number[];
  kills: number;
  /** Kills suffered by lineage of the killer (key: killer lineage). */
  killedBy: Record<number, number>;
  /** Kills made on other lineages (key: victim lineage). */
  killsOf: Record<number, number>;
  fights: number;
  infections: number[];
  macromutants: number;
}

/** Hidden snapshot of one species. Never sent to clients before the final reveal. */
export interface SpeciesSample {
  tick: number;
  species: number;
  lineage: number;
  count: number;
  adults: number;
  juveniles: number;
  /** Total live mass (biomass). */
  biomass: number;
  traitMean: Float32Array;
  traitSd: Float32Array;
  /** Means over adults and juveniles separately (parents vs offspring comparisons). */
  adultMean: Float32Array;
  juvenileMean: Float32Array;
  speedMean: number;
  speedSd: number;
  massMean: number;
  massSd: number;
  /** Mean per-locus allele variance (genetic diversity). */
  diversity: number;
  /** Mean number of homozygous deleterious loci. */
  deleteriousLoad: number;
  /** Fraction of individuals with at least one homozygous deleterious locus. */
  deleteriousAffected: number;
  caps: number[];
  infected: number;
  cx: number;
  cy: number;
  spread: number;
  generationMean: number;
  period: PeriodCounters;
}

function emptyCounters(): PeriodCounters {
  return {
    births: 0,
    matings: 0,
    littersLost: 0,
    deaths: new Array<number>(DEATH_COUNT).fill(0),
    deathRelMass: new Array<number>(DEATH_COUNT).fill(0),
    deathAgeFrac: new Array<number>(DEATH_COUNT).fill(0),
    diet: new Array<number>(FOOD_COUNT).fill(0),
    kills: 0,
    killedBy: {},
    killsOf: {},
    fights: 0,
    infections: [],
    macromutants: 0,
  };
}

const NON_RECOGNITION = LOCI.flatMap((l, i) => (l.kind !== 'recognition' ? [i] : []));

/**
 * Records hidden statistics: periodic species samples plus event counters.
 * Feeds the field notebook, scoring, oracle bots and the final reveal.
 */
export class StatsRecorder {
  readonly samples: SpeciesSample[] = [];
  private counters = new Map<number, PeriodCounters>();
  /** Running mean mass per species from the last sample (for relative death mass). */
  private lastMassMean = new Map<number, number>();
  /** Optional cap on retained samples (oldest dropped); 0 = keep all. */
  maxSamples = 0;

  constructor(private readonly sim: ParcelSim) {}

  counter(species: number): PeriodCounters {
    let c = this.counters.get(species);
    if (!c) {
      c = emptyCounters();
      this.counters.set(species, c);
    }
    return c;
  }

  onBirth(i: number): void {
    this.counter(this.sim.org.species[i] as number).births++;
  }

  onDeath(i: number, cause: number): void {
    const o = this.sim.org;
    const sp = o.species[i] as number;
    const c = this.counter(sp);
    c.deaths[cause] = (c.deaths[cause] as number) + 1;
    const mean = this.lastMassMean.get(sp) ?? (o.mass[i] as number);
    c.deathRelMass[cause] = (c.deathRelMass[cause] as number) + (o.mass[i] as number) / mean;
    const life = o.derived[i * DERIVED_COUNT + D.Lifespan] as number;
    c.deathAgeFrac[cause] = (c.deathAgeFrac[cause] as number) + this.sim.age(i) / life;
  }

  onEat(i: number, food: number, energy: number): void {
    const c = this.counter(this.sim.org.species[i] as number);
    c.diet[food] = (c.diet[food] as number) + energy;
  }

  onKill(hunter: number, prey: number): void {
    const o = this.sim.org;
    const c = this.counter(o.species[hunter] as number);
    c.kills++;
    const victimLineage = o.lineage[prey] as number;
    c.killsOf[victimLineage] = (c.killsOf[victimLineage] ?? 0) + 1;
    const v = this.counter(o.species[prey] as number);
    const hl = o.lineage[hunter] as number;
    v.killedBy[hl] = (v.killedBy[hl] ?? 0) + 1;
  }

  onFight(winner: number, _loser: number): void {
    this.counter(this.sim.org.species[winner] as number).fights++;
  }

  onMating(f: number): void {
    this.counter(this.sim.org.species[f] as number).matings++;
  }

  onLitter(f: number, born: number, conceived: number): void {
    if (born < conceived) this.counter(this.sim.org.species[f] as number).littersLost += conceived - born;
  }

  onInfection(j: number, strain: number): void {
    const c = this.counter(this.sim.org.species[j] as number);
    c.infections[strain] = (c.infections[strain] ?? 0) + 1;
  }

  /** Takes a census of every species present. */
  sample(): void {
    const sim = this.sim;
    const o = sim.org;
    const groups = new Map<number, number[]>();
    for (let i = 0; i < o.high; i++) {
      if (!o.alive[i]) continue;
      const sp = o.species[i] as number;
      let g = groups.get(sp);
      if (!g) {
        g = [];
        groups.set(sp, g);
      }
      g.push(i);
    }
    // Species with counters but no individuals still report (extinction period).
    for (const sp of this.counters.keys()) if (!groups.has(sp)) groups.set(sp, []);
    const sorted = [...groups.keys()].sort((a, b) => a - b);
    for (const sp of sorted) {
      const members = groups.get(sp) as number[];
      const info = sim.species.get(sp);
      const s = censusOf(sim, members, sp, info?.lineage ?? 0);
      s.period = this.counters.get(sp) ?? emptyCounters();
      this.samples.push(s);
      this.lastMassMean.set(sp, s.massMean || 1);
      if (info && members.length > 0) {
        // Track capabilities that became common.
        for (let k = 0; k < CAPABILITY_COUNT; k++) {
          if ((s.caps[k] as number) > 0.25 * members.length && members.length >= 8) info.capsCommon |= (CAPABILITIES[k] as { bit: number }).bit;
        }
      }
      if (info && members.length === 0 && info.extinctTick < 0) info.extinctTick = sim.tick;
    }
    this.counters = new Map();
    if (this.maxSamples > 0 && this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
  }

  /** Samples of one species in tick order. */
  series(species: number): SpeciesSample[] {
    return this.samples.filter((s) => s.species === species);
  }

  latest(species: number): SpeciesSample | undefined {
    for (let k = this.samples.length - 1; k >= 0; k--) if (this.samples[k]?.species === species) return this.samples[k];
    return undefined;
  }
}

/** Census of an explicit set of organisms (also used directly by experiments). */
export function censusOf(sim: ParcelSim, members: readonly number[], species: number, lineage: number): SpeciesSample {
  const o = sim.org;
  const n = members.length;
  const traitMean = new Float32Array(TRAIT_COUNT);
  const traitSd = new Float32Array(TRAIT_COUNT);
  const adultMean = new Float32Array(TRAIT_COUNT);
  const juvenileMean = new Float32Array(TRAIT_COUNT);
  const sum = new Float64Array(TRAIT_COUNT);
  const sum2 = new Float64Array(TRAIT_COUNT);
  const sumA = new Float64Array(TRAIT_COUNT);
  const sumJ = new Float64Array(TRAIT_COUNT);
  let adults = 0;
  let speed = 0;
  let speed2 = 0;
  let mass = 0;
  let mass2 = 0;
  let biomass = 0;
  let load = 0;
  let affected = 0;
  let infected = 0;
  let cx = 0;
  let cy = 0;
  let gen = 0;
  const caps = new Array<number>(CAPABILITY_COUNT).fill(0);
  for (const i of members) {
    const p = i * TRAIT_COUNT;
    const adult = sim.isAdult(i);
    if (adult) adults++;
    for (let t = 0; t < TRAIT_COUNT; t++) {
      const v = o.pheno[p + t] as number;
      sum[t] = (sum[t] as number) + v;
      sum2[t] = (sum2[t] as number) + v * v;
      if (adult) sumA[t] = (sumA[t] as number) + v;
      else sumJ[t] = (sumJ[t] as number) + v;
    }
    const sp = o.derived[i * DERIVED_COUNT + D.MaxSpeed] as number;
    speed += sp;
    speed2 += sp * sp;
    const m = o.mass[i] as number;
    biomass += m;
    if (adult) {
      mass += m;
      mass2 += m * m;
    }
    const dl = o.delLoad[i] as number;
    load += dl;
    if (dl > 0) affected++;
    if (o.infection[i]) infected++;
    cx += o.x[i] as number;
    cy += o.y[i] as number;
    gen += o.generation[i] as number;
    const bits = o.capabilities[i] as number;
    for (let k = 0; k < CAPABILITY_COUNT; k++) if (bits & (CAPABILITIES[k] as { bit: number }).bit) caps[k]!++;
  }
  const juveniles = n - adults;
  for (let t = 0; t < TRAIT_COUNT; t++) {
    const m = n > 0 ? (sum[t] as number) / n : 0;
    traitMean[t] = m;
    traitSd[t] = n > 1 ? Math.sqrt(Math.max(0, (sum2[t] as number) / n - m * m)) : 0;
    adultMean[t] = adults > 0 ? (sumA[t] as number) / adults : m;
    juvenileMean[t] = juveniles > 0 ? (sumJ[t] as number) / juveniles : m;
  }
  const speedMean = n > 0 ? speed / n : 0;
  const massMean = adults > 0 ? mass / adults : 0;
  cx = n > 0 ? cx / n : 0;
  cy = n > 0 ? cy / n : 0;
  let spread = 0;
  for (const i of members) spread += Math.hypot((o.x[i] as number) - cx, (o.y[i] as number) - cy);
  return {
    tick: sim.tick,
    species,
    lineage,
    count: n,
    adults,
    juveniles,
    biomass,
    traitMean,
    traitSd,
    adultMean,
    juvenileMean,
    speedMean,
    speedSd: n > 1 ? Math.sqrt(Math.max(0, speed2 / n - speedMean * speedMean)) : 0,
    massMean,
    massSd: adults > 1 ? Math.sqrt(Math.max(0, mass2 / adults - massMean * massMean)) : 0,
    diversity: alleleDiversity(o.alleles, members),
    deleteriousLoad: n > 0 ? load / n : 0,
    deleteriousAffected: n > 0 ? affected / n : 0,
    caps,
    infected,
    cx,
    cy,
    spread: n > 0 ? spread / n : 0,
    generationMean: n > 0 ? gen / n : 0,
    period: emptyCounters(),
  };
}

/** Mean over (non-recognition) loci of the variance of allele values in the group. */
export function alleleDiversity(alleles: Float32Array, members: readonly number[]): number {
  const n = members.length;
  if (n < 2) return 0;
  let total = 0;
  for (const l of NON_RECOGNITION) {
    let s = 0;
    let s2 = 0;
    for (const i of members) {
      const a = alleles[i * ALLELES_PER_GENOME + 2 * l] as number;
      const b = alleles[i * ALLELES_PER_GENOME + 2 * l + 1] as number;
      s += a + b;
      s2 += a * a + b * b;
    }
    const m = s / (2 * n);
    total += s2 / (2 * n) - m * m;
  }
  return total / NON_RECOGNITION.length;
}

