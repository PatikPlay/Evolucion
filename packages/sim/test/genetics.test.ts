import { describe, expect, it } from 'vitest';
import { Rng } from '../src/rng';
import {
  DELETERIOUS_LOCI,
  LOCUS_COUNT,
  ALLELES_PER_GENOME,
  LOCI,
} from '../src/genetics/genome-map';
import {
  deleteriousCopies,
  deleteriousLoad,
  expressGenome,
  inheritAlleles,
  inheritDeleterious,
  locusValue,
  popcount,
} from '../src/genetics/genome';
import { sampleFounders, solveAlleleMeans, templateTargets } from '../src/genetics/templates';
import { TRAIT_COUNT } from '../src/genetics/traits';

describe('genetics', () => {
  it('has 40–80 continuous loci plus deleterious loci', () => {
    expect(LOCUS_COUNT).toBeGreaterThanOrEqual(40);
    expect(LOCUS_COUNT).toBeLessThanOrEqual(80);
    expect(DELETERIOUS_LOCI).toBe(64);
    expect(LOCI.some((l) => l.kind === 'pleiotropic')).toBe(true);
    expect(LOCI.some((l) => l.kind === 'latent')).toBe(true);
    expect(LOCI.some((l) => l.kind === 'cryptic')).toBe(true);
  });

  it('expresses dominance: recessive high alleles hide in heterozygotes', () => {
    expect(locusValue(3, 0, 0.5)).toBeCloseTo(1.5);
    expect(locusValue(3, 0, 0.2)).toBeCloseTo(0.6);
    expect(locusValue(3, 0, 0.7)).toBeCloseTo(2.1);
  });

  it('inherits one allele per locus from each parent (Mendelian ratios)', () => {
    const rng = new Rng('mendel');
    const mother = new Float32Array(ALLELES_PER_GENOME);
    const father = new Float32Array(ALLELES_PER_GENOME);
    for (let l = 0; l < LOCUS_COUNT; l++) {
      mother[2 * l] = 1;
      mother[2 * l + 1] = 2;
      father[2 * l] = 3;
      father[2 * l + 1] = 4;
    }
    const child = new Float32Array(ALLELES_PER_GENOME);
    const counts = [0, 0, 0, 0, 0];
    const noMut = { rate: 0, sd: 0, recognitionMult: 1, deleteriousRate: 0 };
    for (let k = 0; k < 2000; k++) {
      inheritAlleles(mother, 0, father, 0, child, 0, rng, noMut);
      counts[child[0] as number]!++;
      counts[child[1] as number]!++;
    }
    expect(counts[1]! / 2000).toBeCloseTo(0.5, 1);
    expect(counts[3]! / 2000).toBeCloseTo(0.5, 1);
  });

  it('mutates at roughly the configured rate', () => {
    const rng = new Rng('mut');
    const parent = new Float32Array(ALLELES_PER_GENOME);
    const child = new Float32Array(ALLELES_PER_GENOME);
    let changed = 0;
    const n = 2000;
    for (let k = 0; k < n; k++) {
      inheritAlleles(parent, 0, parent, 0, child, 0, rng, {
        rate: 0.01,
        sd: 0.2,
        recognitionMult: 1,
        deleteriousRate: 0,
      });
      for (let a = 0; a < ALLELES_PER_GENOME; a++) if (child[a] !== 0) changed++;
    }
    expect(changed / (n * ALLELES_PER_GENOME)).toBeCloseTo(0.01, 2);
  });

  it('deleterious haplotypes recombine and homozygosity is counted', () => {
    const rng = new Rng('del');
    expect(popcount(0xffffffff)).toBe(32);
    // Genome: haplotype A = words [a0, a1], haplotype B = words [b0, b1].
    const g = Uint32Array.from([0b1011, 0b1, 0b0011, 0b1]);
    expect(deleteriousLoad(g, 0)).toBe(3);
    expect(deleteriousCopies(g, 0)).toBe(7);
    const parent = Uint32Array.from([0xffffffff, 0xffffffff, 0, 0]);
    const child = new Uint32Array(4);
    inheritDeleterious(parent, 0, child, 0, rng, 0);
    const n = popcount(child[0] as number) + popcount(child[1] as number);
    expect(n).toBeGreaterThan(16);
    expect(n).toBeLessThan(48);
    expect(child[2]).toBe(0);
  });

  it('founder allele means reproduce the template targets', () => {
    const tpl = { key: 't', traits: { legLength: 0.7, armor: 0.2, hue: 0.8 } };
    const means = solveAlleleMeans(tpl, new Rng('solve'), 0.15);
    const out = new Float32Array(TRAIT_COUNT);
    expressGenome(means, 0, out, 0, 0.15);
    const targets = templateTargets(tpl);
    for (let t = 0; t < TRAIT_COUNT; t++)
      expect(Math.abs((out[t] as number) - (targets[t] as number))).toBeLessThan(0.03);
    const f = sampleFounders(tpl, 30, new Rng('founders'), 0.15, 0.4);
    expect(f.alleles.length).toBe(30 * ALLELES_PER_GENOME);
  });
});
