/**
 * Controlled selection experiments (H1 acceptance). Each experiment runs a
 * treated and a control population from the same seed and reports the
 * measured response. Thresholds live in the tests, not here.
 */
import {
  ParcelSim,
  TICKS_PER_YEAR,
  T,
  D,
  NPC_LINEAGE_BASE,
  censusOf,
  type DeepPartial,
  type SimConfig,
  type SpeciesSample,
} from '../../src/index';
import { PREDATOR_TEMPLATE } from '../../src/genetics/archetypes';

/** Experiments use a richer, lab-like parcel so populations are large enough to measure. */
export const EXPERIMENT_CONFIG: DeepPartial<SimConfig> = {
  world: { targetProductivityPerCell: 9 },
};

const PREY_LINEAGE = 0;
/** Predators kept at this share of the prey population during experiment (a). */
export const PREDATOR_SHARE = 0.12;

export function establish(
  seed: string,
  years: number,
  founders = 80,
  config: DeepPartial<SimConfig> = EXPERIMENT_CONFIG,
  variant?: string,
): { sim: ParcelSim; species: number } {
  const sim = new ParcelSim({ seed, config, ...(variant ? { variant } : {}) });
  const species = sim.spawnFounders({ key: 'base', traits: {} }, founders, PREY_LINEAGE);
  sim.run(years * TICKS_PER_YEAR);
  return { sim, species };
}

export function census(sim: ParcelSim, species: number): SpeciesSample {
  return censusOf(sim, sim.living({ species }), species, PREY_LINEAGE);
}

/** Mean and sd of a derived quantity over a species. */
export function derivedStats(
  sim: ParcelSim,
  species: number,
  d: D,
): { mean: number; sd: number; n: number } {
  const xs = sim.living({ species }).map((i) => sim.der(i, d));
  return meanSd(xs);
}

export function meanSd(xs: readonly number[]): { mean: number; sd: number; n: number } {
  const n = xs.length;
  if (n === 0) return { mean: 0, sd: 0, n: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const v = n > 1 ? xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1) : 0;
  return { mean, sd: Math.sqrt(v), n };
}

/** Runs until the population has advanced `generations` generations (or `maxYears`). */
function runGenerations(
  sim: ParcelSim,
  species: number,
  generations: number,
  maxYears: number,
  eachYear?: (year: number) => void,
): number {
  const start = census(sim, species).generationMean;
  let years = 0;
  while (years < maxYears) {
    eachYear?.(years);
    sim.run(TICKS_PER_YEAR);
    years++;
    const c = census(sim, species);
    if (c.count === 0 || c.generationMean - start >= generations) break;
  }
  return years;
}

export interface ResponseResult {
  seed: string;
  before: { mean: number; sd: number; n: number };
  treated: { mean: number; sd: number; n: number };
  control: { mean: number; sd: number; n: number };
  years: number;
  /** (Δtreated − Δcontrol) in units of the initial sd. */
  effect: number;
  /** (treated − control) / standard error of the difference. */
  z: number;
  notes: string;
}

function response(
  seed: string,
  before: ResponseResult['before'],
  treated: ResponseResult['treated'],
  control: ResponseResult['control'],
  years: number,
  notes: string,
  sign = 1,
): ResponseResult {
  const se =
    Math.sqrt(
      (treated.sd * treated.sd) / Math.max(1, treated.n) +
        (control.sd * control.sd) / Math.max(1, control.n),
    ) || 1e-9;
  // A treated population that (nearly) died out shows no response at all.
  if (treated.n < 10 || control.n < 10)
    return {
      seed,
      before,
      treated,
      control,
      years,
      effect: Number.NEGATIVE_INFINITY,
      z: Number.NEGATIVE_INFINITY,
      notes: `extinct ${notes}`,
    };
  return {
    seed,
    before,
    treated,
    control,
    years,
    effect: (sign * (treated.mean - control.mean)) / (before.sd || 1e-9),
    z: (sign * (treated.mean - control.mean)) / se,
    notes,
  };
}

/** Pools replicate measurements (mean of means, pooled sd, summed n). */
function pool(xs: Array<{ mean: number; sd: number; n: number }>): {
  mean: number;
  sd: number;
  n: number;
} {
  const ok = xs.filter((x) => x.n > 0);
  if (ok.length === 0) return { mean: 0, sd: 0, n: 0 };
  return {
    mean: ok.reduce((a, x) => a + x.mean, 0) / ok.length,
    sd: Math.sqrt(ok.reduce((a, x) => a + x.sd * x.sd, 0) / ok.length),
    n: ok.reduce((a, x) => a + x.n, 0),
  };
}

/**
 * (a) Fast predators: prey speed should rise. Replicated lines: `replicates`
 * treated and as many control populations per seed (same world, independent
 * histories); the seed's result compares their means.
 */
export function fastPredatorExperiment(
  seed: string,
  generations = 10,
  predatorShare = PREDATOR_SHARE,
  config: DeepPartial<SimConfig> = EXPERIMENT_CONFIG,
  replicates = 3,
): ResponseResult {
  const setupYears = 5;
  const treatedStats: Array<{ mean: number; sd: number; n: number }> = [];
  const controlStats: Array<{ mean: number; sd: number; n: number }> = [];
  const befores: Array<{ mean: number; sd: number; n: number }> = [];
  let years = 0;
  let kills = 0;
  let deaths = 0;
  for (let r = 0; r < replicates; r++) {
    // Paired lines: treated and control start from the very same population.
    const t = establish(seed, setupYears, 80, config, `r${r}`);
    const c = establish(seed, setupYears, 80, config, `r${r}`);
    befores.push(derivedStats(t.sim, t.species, D.MaxSpeed));
    let predSpecies = -1;
    const y = runGenerations(t.sim, t.species, generations, 16, () => {
      // Sustained pressure: keep a hunting population present.
      const preds = predSpecies < 0 ? 0 : t.sim.count({ species: predSpecies });
      const prey = t.sim.count({ species: t.species });
      // Top up hunters while the prey can bear it (a crashed prey population only drifts).
      const wanted = prey >= 250 ? Math.max(8, Math.round(prey * predatorShare)) : 0;
      if (preds < wanted) {
        predSpecies = t.sim.spawnFounders(PREDATOR_TEMPLATE, wanted - preds, NPC_LINEAGE_BASE, {
          ...(predSpecies >= 0 ? { species: predSpecies } : {}),
          archetype: 'predator',
          region: { x: t.sim.width / 2, y: t.sim.height / 2, r: 40 },
        });
      }
    });
    c.sim.run(y * TICKS_PER_YEAR);
    years = Math.max(years, y);
    const ts = derivedStats(t.sim, t.species, D.MaxSpeed);
    if (ts.n < 10)
      return response(
        seed,
        pool(befores),
        ts,
        derivedStats(c.sim, c.species, D.MaxSpeed),
        y,
        'replicate extinct',
      );
    treatedStats.push(ts);
    controlStats.push(derivedStats(c.sim, c.species, D.MaxSpeed));
    const prey = t.sim.stats.samples.filter((s) => s.species === t.species);
    kills += prey.reduce((a, s) => a + s.period.deaths[2]!, 0);
    deaths += prey.reduce((a, s) => a + s.period.deaths.reduce((x, z) => x + z, 0), 0);
  }
  const treated = pool(treatedStats);
  const control = pool(controlStats);
  return response(
    seed,
    pool(befores),
    treated,
    control,
    years,
    `predation=${Math.round((100 * kills) / Math.max(1, deaths))}% of deaths prey n=${treated.n} ctl n=${control.n}`,
  );
}

/** (b) Sustained cold: cold tolerance (lower comfort limit) should improve. */
export function coldExperiment(seed: string, generations = 10, anomaly = -5): ResponseResult {
  const setupYears = 3;
  const t = establish(seed, setupYears);
  const c = establish(seed, setupYears);
  // Tolerance = how far below 0 °C the animal stays comfortable: -comfortLow.
  const tol = (sim: ParcelSim, sp: number) =>
    meanSd(sim.living({ species: sp }).map((i) => -sim.der(i, D.ComfortLow)));
  const before = tol(t.sim, t.species);
  t.sim.apply({ type: 'climate', tempAnomaly: anomaly });
  const years = runGenerations(t.sim, t.species, generations, 16);
  c.sim.run(years * TICKS_PER_YEAR);
  const treated = tol(t.sim, t.species);
  const control = tol(c.sim, c.species);
  const ct = census(t.sim, t.species).traitMean[T.ColdTolerance] ?? 0;
  const cc = census(c.sim, c.species).traitMean[T.ColdTolerance] ?? 0;
  return response(
    seed,
    before,
    treated,
    control,
    years,
    `coldTrait treated=${ct.toFixed(3)} control=${cc.toFixed(3)} n=${treated.n}/${control.n}`,
  );
}

/** Traits with no fitness effect in the default parcel (no pleiotropy, absent conditions). */
export const NEUTRAL_TRAITS: readonly T[] = [
  T.Stripes,
  T.ImmunityC,
  T.ImmunityD,
  T.Elongation,
  T.PrefSize,
];

export interface DriftResult {
  seed: string;
  years: number;
  /** Change of each neutral trait mean, in units of its initial sd. */
  deltas: number[];
  count: number;
}

/** (c) No added pressure: neutral traits drift without a consistent direction. */
export function driftExperiment(seed: string, generations = 10): DriftResult {
  const t = establish(seed, 2);
  const c0 = census(t.sim, t.species);
  const years = runGenerations(t.sim, t.species, generations, 16);
  const c1 = census(t.sim, t.species);
  const deltas = NEUTRAL_TRAITS.map(
    (tr) => ((c1.traitMean[tr] ?? 0) - (c0.traitMean[tr] ?? 0)) / ((c0.traitSd[tr] ?? 0) || 1e-9),
  );
  return { seed, years, deltas, count: c1.count };
}

export interface BottleneckResult {
  seed: string;
  diversityBefore: number;
  diversityTreated: number;
  diversityControl: number;
  heterozygosityTreated: number;
  heterozygosityControl: number;
  affectedBefore: number;
  affectedTreated: number;
  affectedControl: number;
  loadTreated: number;
  loadControl: number;
  expressionTreated: number;
  expressionControl: number;
  survivors: number;
  countTreated: number;
}

/**
 * (d) Bottleneck: a crash to a handful of survivors, a few years at small size
 * (as after a catastrophe), then recovery. Diversity drops and recessive
 * deleterious alleles surface through inbreeding.
 */
export function bottleneckExperiment(
  seed: string,
  keep = 6,
  smallYears = 3,
  recoveryYears = 1,
  replicates = 5,
  setupYears = 7,
): BottleneckResult {
  const c = establish(seed, setupYears);
  const b = census(c.sim, c.species);
  c.sim.run((smallYears + recoveryYears) * TICKS_PER_YEAR);
  const cc = census(c.sim, c.species);
  // Several independent refuges per seed: with six founders each replicate is
  // largely a lottery of which alleles survive, so the seed's result is their mean.
  const reps: SpeciesSample[] = [];
  let survivors = 0;
  for (let r = 0; r < replicates; r++) {
    const t = establish(seed, setupYears, 80, EXPERIMENT_CONFIG, `r${r}`);
    const members = t.sim.living({ species: t.species });
    const anchor = members[t.sim.rngEcology.int(members.length)] as number;
    t.sim.apply({
      type: 'cull',
      species: t.species,
      keep,
      balanceSexes: true,
      near: { x: t.sim.org.x[anchor] as number, y: t.sim.org.y[anchor] as number },
    });
    survivors += t.sim.count({ species: t.species });
    for (let y = 0; y < smallYears + recoveryYears; y++) {
      t.sim.run(TICKS_PER_YEAR);
      if (y < smallYears && t.sim.count({ species: t.species }) > 15)
        t.sim.apply({ type: 'cull', species: t.species, keep: 15 });
    }
    const ct = census(t.sim, t.species);
    if (ct.count > 0) reps.push(ct);
  }
  const avg = (f: (s: SpeciesSample) => number) =>
    reps.length ? reps.reduce((a, s) => a + f(s), 0) / reps.length : 0;
  return {
    seed,
    diversityBefore: b.diversity,
    diversityTreated: avg((s) => s.diversity),
    diversityControl: cc.diversity,
    heterozygosityTreated: avg((s) => s.heterozygosity),
    heterozygosityControl: cc.heterozygosity,
    affectedBefore: b.deleteriousAffected,
    affectedTreated: avg((s) => s.deleteriousAffected),
    affectedControl: cc.deleteriousAffected,
    loadTreated: avg((s) => s.deleteriousLoad),
    loadControl: cc.deleteriousLoad,
    expressionTreated: avg((s) => s.deleteriousExpression),
    expressionControl: cc.deleteriousExpression,
    survivors: survivors / replicates,
    countTreated: reps.length ? Math.round(avg((s) => s.count)) : 0,
  };
}

export function seeds(n: number, prefix = 'exp'): string[] {
  return Array.from({ length: n }, (_, k) => `${prefix}-${k + 1}`);
}
