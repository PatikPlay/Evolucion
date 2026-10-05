import type { Rng } from '../rng';
import { logit } from '../math';
import { geneticValues } from './genome';
import { ALLELES_PER_GENOME, DELETERIOUS_LOCI, LOCI, LOCUS_COUNT } from './genome-map';
import { T, TRAITS, TRAIT_COUNT, TRAIT_INDEX, traitFromMass } from './traits';

export type TraitKey = (typeof TRAITS)[number]['key'];

/**
 * A species template: target mean trait values. Founder populations are
 * sampled around allele means solved from these targets.
 */
export interface SpeciesTemplate {
  readonly key: string;
  /** Target means in [0,1]; unlisted traits use BASE_TRAITS. */
  readonly traits: Readonly<Partial<Record<string, number>>>;
  /** Adult mass in mass units; overrides `traits.mass`. */
  readonly mass?: number;
  /** Allele standard deviation of the founders (standing variation). */
  readonly variation?: number;
}

/** A generic small omnivore-leaning herbivore: the neutral starting point. */
export const BASE_TRAITS: Readonly<Record<string, number>> = {
  mass: 0.5,
  elongation: 0.45,
  legLength: 0.5,
  legCount: 0.55,
  legStrength: 0.45,
  prehensile: 0.2,
  fins: 0.08,
  membranes: 0.08,
  armor: 0.15,
  spines: 0.12,
  tail: 0.5,
  fur: 0.4,
  hue: 0.4,
  lightness: 0.45,
  conspicuous: 0.35,
  spots: 0.2,
  stripes: 0.15,
  eyeSize: 0.45,
  nightVision: 0.35,
  smell: 0.45,
  hearing: 0.45,
  metabolism: 0.5,
  coldTolerance: 0.45,
  heatTolerance: 0.45,
  fatReserves: 0.35,
  longevity: 0.45,
  waterEfficiency: 0.35,
  carnivory: 0.15,
  fiberDigestion: 0.5,
  plantToxinTolerance: 0.4,
  algaeDigestion: 0.15,
  toxinProduction: 0.1,
  toxinResistance: 0.3,
  immunityA: 0.45,
  immunityB: 0.45,
  immunityC: 0.45,
  immunityD: 0.45,
  aggression: 0.35,
  fear: 0.55,
  sociability: 0.45,
  curiosity: 0.45,
  territoriality: 0.35,
  nocturnality: 0.25,
  parentalCare: 0.45,
  brain: 0.3,
  growth: 0.45,
  litterSize: 0.32,
  investment: 0.45,
  prefConspicuous: 0.4,
  prefSize: 0.4,
};

export function templateTargets(tpl: SpeciesTemplate): Float64Array {
  const out = new Float64Array(TRAIT_COUNT);
  for (let t = 0; t < TRAIT_COUNT; t++) {
    const key = (TRAITS[t] as { key: string }).key;
    out[t] = tpl.traits[key] ?? BASE_TRAITS[key] ?? 0.5;
  }
  if (tpl.mass !== undefined) out[T.Mass] = traitFromMass(tpl.mass);
  return out;
}

/** Dedicated loci per trait: trait loci whose first (main) effect is that trait. */
const DEDICATED: number[][] = Array.from({ length: TRAIT_COUNT }, () => []);
LOCI.forEach((l, i) => {
  if (l.kind === 'trait' || l.kind === 'latent') {
    const main = l.effects[0];
    if (main) (DEDICATED[main[0]] as number[]).push(i);
  }
});

/**
 * Solves allele means so the expressed means hit the template targets.
 * Pleiotropic, cryptic and recognition loci get random means (species identity),
 * then dedicated loci absorb the residual (Gauss–Seidel over a few sweeps).
 */
export function solveAlleleMeans(tpl: SpeciesTemplate, rng: Rng, canalisation: number): Float32Array {
  const targets = templateTargets(tpl);
  const mean = new Float32Array(ALLELES_PER_GENOME);
  LOCI.forEach((l, i) => {
    let v = 0;
    if (l.kind === 'pleiotropic') v = rng.gaussian(0, 0.3);
    else if (l.kind === 'cryptic') v = rng.gaussian(0, 0.5);
    else if (l.kind === 'recognition') v = rng.gaussian(0, 0.8);
    mean[2 * i] = v;
    mean[2 * i + 1] = v;
  });
  const g = new Float64Array(TRAIT_COUNT);
  for (let sweep = 0; sweep < 8; sweep++) {
    for (let t = 0; t < TRAIT_COUNT; t++) {
      const loci = DEDICATED[t] as number[];
      if (loci.length === 0) continue;
      geneticValues(mean, 0, canalisation, g);
      const residual = logit(targets[t] as number) - (g[t] as number);
      let wsum = 0;
      for (const l of loci) wsum += (LOCI[l]?.effects[0]?.[1] ?? 1) as number;
      const delta = residual / wsum;
      for (const l of loci) {
        mean[2 * l] = (mean[2 * l] as number) + delta;
        mean[2 * l + 1] = (mean[2 * l + 1] as number) + delta;
      }
    }
  }
  return mean;
}

export interface FounderGenomes {
  readonly count: number;
  /** count × ALLELES_PER_GENOME */
  readonly alleles: Float32Array;
  /** count × 2 haplotype masks */
  readonly delet: Uint32Array;
}

/** Samples `count` founder genomes around the template's allele means. */
export function sampleFounders(tpl: SpeciesTemplate, count: number, rng: Rng, canalisation: number, standingVariation: number): FounderGenomes {
  const means = solveAlleleMeans(tpl, rng.fork('means'), canalisation);
  return sampleAround(means, count, rng.fork('individuals'), tpl.variation ?? standingVariation);
}

export function sampleAround(means: Float32Array, count: number, rng: Rng, sd: number): FounderGenomes {
  const alleles = new Float32Array(count * ALLELES_PER_GENOME);
  const delet = new Uint32Array(count * 2);
  // Per-locus deleterious allele frequency (low: harmless in large populations).
  const freqs: number[] = [];
  for (let k = 0; k < DELETERIOUS_LOCI; k++) freqs.push(0.03 + rng.float() * 0.06);
  for (let n = 0; n < count; n++) {
    for (let a = 0; a < ALLELES_PER_GENOME; a++) alleles[n * ALLELES_PER_GENOME + a] = (means[a] as number) + rng.gaussian(0, sd);
    for (let h = 0; h < 2; h++) {
      let mask = 0;
      for (let k = 0; k < DELETERIOUS_LOCI; k++) if (rng.chance(freqs[k] as number)) mask |= 1 << k;
      delet[n * 2 + h] = mask >>> 0;
    }
  }
  return { count, alleles, delet };
}

export function traitIndex(key: string): number {
  const i = TRAIT_INDEX[key];
  if (i === undefined) throw new Error(`Unknown trait ${key}`);
  return i;
}

export { LOCUS_COUNT };
