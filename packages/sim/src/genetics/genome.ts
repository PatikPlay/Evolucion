import type { Rng } from '../rng';
import { sigmoid } from '../math';
import {
  ALLELES_PER_GENOME,
  DELETERIOUS_LOCI,
  DELETERIOUS_MASK,
  GENOME_MAP,
  LOCI,
  LOCUS_COUNT,
  MACRO_LOCI,
  RECOGNITION_LOCI,
  type CompiledGenomeMap,
} from './genome-map';
import { TRAIT_COUNT } from './traits';

/** Value of a diploid locus given its two alleles and the dominance of the higher allele. */
export function locusValue(a1: number, a2: number, dominance: number): number {
  if (dominance === 0.5) return (a1 + a2) * 0.5;
  const hi = a1 > a2 ? a1 : a2;
  const lo = a1 > a2 ? a2 : a1;
  return dominance * hi + (1 - dominance) * lo;
}

const geneticScratch = new Float64Array(TRAIT_COUNT);

/** Raw (pre-sigmoid) genetic values of every trait. */
export function geneticValues(
  alleles: Float32Array,
  offset: number,
  canalisation: number,
  out: Float64Array = geneticScratch,
  map: CompiledGenomeMap = GENOME_MAP,
): Float64Array {
  out.fill(0);
  const { effectStart, effectTrait, effectWeight, dominance, cryptic } = map;
  for (let l = 0; l < LOCUS_COUNT; l++) {
    const v = locusValue(
      alleles[offset + 2 * l] as number,
      alleles[offset + 2 * l + 1] as number,
      dominance[l] as number,
    );
    if (v === 0) continue;
    const scale = cryptic[l] ? canalisation : 1;
    const end = effectStart[l + 1] as number;
    for (let e = effectStart[l] as number; e < end; e++) {
      const t = effectTrait[e] as number;
      out[t] = (out[t] as number) + v * (effectWeight[e] as number) * scale;
    }
  }
  return out;
}

/** Expresses a genome into [0,1] trait values. */
export function expressGenome(
  alleles: Float32Array,
  offset: number,
  out: Float32Array,
  outOffset: number,
  canalisation: number,
): void {
  const g = geneticValues(alleles, offset, canalisation);
  for (let t = 0; t < TRAIT_COUNT; t++) out[outOffset + t] = sigmoid(g[t] as number);
}

export interface MutationParams {
  rate: number;
  sd: number;
  recognitionMult: number;
  deleteriousRate: number;
}

const isRecognition = new Uint8Array(LOCUS_COUNT);
for (const l of RECOGNITION_LOCI) isRecognition[l] = 1;

/**
 * Mendelian inheritance: one allele per locus from each parent, chosen at
 * random, then point mutation (small Gaussian steps).
 */
export function inheritAlleles(
  mother: Float32Array,
  mOff: number,
  father: Float32Array,
  fOff: number,
  child: Float32Array,
  cOff: number,
  rng: Rng,
  mut: MutationParams,
): void {
  let bitsM = 0;
  let bitsF = 0;
  for (let l = 0; l < LOCUS_COUNT; l++) {
    if ((l & 31) === 0) {
      bitsM = rng.nextU32();
      bitsF = rng.nextU32();
    }
    const bm = (bitsM >>> (l & 31)) & 1;
    const bf = (bitsF >>> (l & 31)) & 1;
    child[cOff + 2 * l] = mother[mOff + 2 * l + bm] as number;
    child[cOff + 2 * l + 1] = father[fOff + 2 * l + bf] as number;
  }
  // Point mutations: draw the number of mutations instead of one coin per allele.
  const expected =
    mut.rate * (ALLELES_PER_GENOME + RECOGNITION_LOCI.length * 2 * (mut.recognitionMult - 1));
  let n = poisson(rng, expected);
  while (n-- > 0) {
    // Recognition loci are proportionally more likely to be hit.
    let a = rng.int(ALLELES_PER_GENOME + RECOGNITION_LOCI.length * 2 * (mut.recognitionMult - 1));
    if (a >= ALLELES_PER_GENOME) {
      const extra = a - ALLELES_PER_GENOME;
      const locus = RECOGNITION_LOCI[Math.floor(extra / 2) % RECOGNITION_LOCI.length] as number;
      a = locus * 2 + (extra & 1);
    }
    child[cOff + a] = (child[cOff + a] as number) + rng.gaussian(0, mut.sd);
  }
}

/** Applies a big-effect mutation to one macro-eligible locus. Returns the locus index. */
export function macroMutate(child: Float32Array, cOff: number, rng: Rng, size: number): number {
  const locus = rng.pick(MACRO_LOCI);
  const def = LOCI[locus];
  const sign = def?.macro === 'both' && rng.chance(0.5) ? -1 : 1;
  const a = cOff + 2 * locus + rng.int(2);
  child[a] = (child[a] as number) + sign * size;
  return locus;
}

/** Inherits one haplotype mask from a parent's two masks (free recombination). */
export function inheritHaplotype(
  h0: number,
  h1: number,
  rng: Rng,
  deleteriousRate: number,
): number {
  const mask = rng.nextU32() & DELETERIOUS_MASK;
  let h = ((h0 & mask) | (h1 & ~mask)) & DELETERIOUS_MASK;
  if (rng.float() < deleteriousRate * DELETERIOUS_LOCI) h |= 1 << rng.int(DELETERIOUS_LOCI);
  return h >>> 0;
}

export function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Number of loci homozygous for the deleterious allele. */
export function deleteriousLoad(h0: number, h1: number): number {
  return popcount((h0 & h1) >>> 0);
}

/** Squared distance between two genomes over the mate-recognition loci (per locus mean). */
export function recognitionDistance2(
  a: Float32Array,
  aOff: number,
  b: Float32Array,
  bOff: number,
): number {
  let s = 0;
  for (let k = 0; k < RECOGNITION_LOCI.length; k++) {
    const l = RECOGNITION_LOCI[k] as number;
    const va = ((a[aOff + 2 * l] as number) + (a[aOff + 2 * l + 1] as number)) * 0.5;
    const vb = ((b[bOff + 2 * l] as number) + (b[bOff + 2 * l + 1] as number)) * 0.5;
    const d = va - vb;
    s += d * d;
  }
  return s / RECOGNITION_LOCI.length;
}

/** Knuth's Poisson sampler; fine for the small means used here. */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 30) return Math.max(0, Math.round(rng.gaussian(lambda, Math.sqrt(lambda))));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng.float();
  } while (p > L);
  return k - 1;
}
