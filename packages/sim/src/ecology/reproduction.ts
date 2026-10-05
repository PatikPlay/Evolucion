import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { T, TRAIT_COUNT, litterFromTrait } from '../genetics/traits';
import { ALLELES_PER_GENOME } from '../genetics/genome-map';
import {
  inheritAlleles,
  inheritHaplotype,
  macroMutate,
  recognitionDistance2,
} from '../genetics/genome';
import { Flag } from '../behavior/actions';
import { hueDistance } from '../math';

/** A litter conceived and waiting to be born. */
export interface Litter {
  readonly fatherId: number;
  readonly count: number;
  readonly alleles: Float32Array;
  readonly delet: Uint32Array;
  /** Locus hit by a macromutation per offspring, or -1. */
  readonly macro: Int16Array;
  readonly generation: number;
  readonly species: number;
}

/**
 * Reproductive compatibility in [0,1]: mate-recognition loci plus visible
 * appearance (colour, size). Diverging populations become unable to interbreed.
 */
export function compatibility(sim: ParcelSim, a: number, b: number): number {
  const o = sim.org;
  const scale = sim.cfg.reproduction.compatibilityScale;
  const rd = recognitionDistance2(
    o.alleles,
    a * ALLELES_PER_GENOME,
    o.alleles,
    b * ALLELES_PER_GENOME,
  );
  const pa = a * TRAIT_COUNT;
  const pb = b * TRAIT_COUNT;
  const hue = hueDistance(o.pheno[pa + T.Hue] as number, o.pheno[pb + T.Hue] as number) * 2;
  const size = Math.log(
    (o.derived[a * DERIVED_COUNT + D.AdultMassPotential] as number) /
      (o.derived[b * DERIVED_COUNT + D.AdultMassPotential] as number),
  );
  const d2 = rd + 0.5 * (hue * hue + size * size * 0.5);
  return Math.exp(-d2 / (scale * scale));
}

function receptive(sim: ParcelSim, i: number, female: boolean): boolean {
  const o = sim.org;
  const cfg = sim.cfg.reproduction;
  if (
    !sim.isAdult(i) ||
    sim.tick < (o.cooldownUntil[i] as number) ||
    (o.flags[i] as number) & Flag.Pregnant
  )
    return false;
  const frac = (o.energy[i] as number) / (o.derived[i * DERIVED_COUNT + D.MaxEnergy] as number);
  return frac > (female ? cfg.breedEnergy : cfg.maleBreedEnergy);
}

/** Mating attempt between `i` and `j` (one female, one male of the same species). */
export function mate(sim: ParcelSim, i: number, j: number): void {
  const o = sim.org;
  if (o.sex[i] === o.sex[j] || o.species[i] !== o.species[j]) return;
  const f = o.sex[i] === 0 ? i : j;
  const m = f === i ? j : i;
  if (!receptive(sim, f, true) || !receptive(sim, m, false)) return;
  const cfg = sim.cfg;
  const rng = sim.rngGenetics;
  const tick = sim.tick;
  o.cooldownUntil[m] = tick + Math.floor(cfg.reproduction.cooldown * 0.4);
  o.cooldownUntil[f] = tick + Math.floor(cfg.reproduction.cooldown * 0.5);
  const compat = compatibility(sim, f, m);
  const viability = sim.der(f, D.Viability) * sim.der(m, D.Viability);
  if (rng.float() > compat * viability * 0.9) return;

  const pf = f * TRAIT_COUNT;
  const maxE = sim.der(f, D.MaxEnergy);
  const base = litterFromTrait(o.pheno[pf + T.LitterSize] as number);
  const n = Math.max(1, Math.round(base * Math.min(1, (o.energy[f] as number) / maxE / 0.8)));
  const alleles = new Float32Array(n * ALLELES_PER_GENOME);
  const delet = new Uint32Array(n * 2);
  const macro = new Int16Array(n).fill(-1);
  const ls = sim.lineage(o.lineage[f] as number);
  const g = cfg.genetics;
  const mut = {
    rate: g.mutationRate * ls.mutationMult,
    sd: g.mutationSd,
    recognitionMult: g.recognitionMutationMult,
    deleteriousRate: g.deleteriousMutationRate,
  };
  for (let k = 0; k < n; k++) {
    inheritAlleles(
      o.alleles,
      f * ALLELES_PER_GENOME,
      o.alleles,
      m * ALLELES_PER_GENOME,
      alleles,
      k * ALLELES_PER_GENOME,
      rng,
      mut,
    );
    if (rng.float() < g.macroMutationRate * ls.mutationMult)
      macro[k] = macroMutate(alleles, k * ALLELES_PER_GENOME, rng, g.macroMutationSize);
    delet[2 * k] = inheritHaplotype(
      o.delet[2 * f] as number,
      o.delet[2 * f + 1] as number,
      rng,
      g.deleteriousMutationRate,
    );
    delet[2 * k + 1] = inheritHaplotype(
      o.delet[2 * m] as number,
      o.delet[2 * m + 1] as number,
      rng,
      g.deleteriousMutationRate,
    );
  }
  const litter: Litter = {
    fatherId: o.id[m] as number,
    count: n,
    alleles,
    delet,
    macro,
    generation: Math.max(o.generation[f] as number, o.generation[m] as number) + 1,
    species: o.species[f] as number,
  };
  sim.pendingLitters.set(o.id[f] as number, litter);
  o.flags[f] = (o.flags[f] as number) | Flag.Pregnant;
  const investment = o.pheno[pf + T.Investment] as number;
  o.pregnantUntil[f] =
    tick +
    Math.round(
      cfg.reproduction.gestationBase *
        (1 + 0.8 * investment) *
        Math.pow((o.mass[f] as number) / 4, 0.25),
    );
  sim.stats.onMating(f);
}

/** Delivers the litter carried by mother `f`, as far as her reserves allow. */
export function giveBirth(sim: ParcelSim, f: number): void {
  const o = sim.org;
  o.flags[f] = (o.flags[f] as number) & ~Flag.Pregnant;
  const id = o.id[f] as number;
  const litter = sim.pendingLitters.get(id);
  sim.pendingLitters.delete(id);
  if (!litter) return;
  const cfg = sim.cfg;
  const pf = f * TRAIT_COUNT;
  const investment = o.pheno[pf + T.Investment] as number;
  const frac = cfg.reproduction.birthMassBase + cfg.reproduction.birthMassInvestment * investment;
  const adultMass = sim.der(f, D.AdultMassPotential);
  const birthMass = adultMass * frac;
  // Energy handed to each newborn plus the tissue it is made of.
  const fat = o.pheno[pf + T.FatReserves] as number;
  const perChild =
    (birthMass * (cfg.organisms.reservePerMass + cfg.organisms.reserveFatBonus * fat) * 0.85 +
      birthMass * 0.35) *
    cfg.reproduction.costOverhead;
  const maxE = sim.der(f, D.MaxEnergy);
  const rng = sim.rngSpawn;
  let born = 0;
  for (let k = 0; k < litter.count; k++) {
    if ((o.energy[f] as number) - perChild < maxE * 0.12) break;
    o.energy[f] = (o.energy[f] as number) - perChild;
    const x = Math.min(sim.width - 0.01, Math.max(0, (o.x[f] as number) + rng.range(-0.6, 0.6)));
    const y = Math.min(sim.height - 0.01, Math.max(0, (o.y[f] as number) + rng.range(-0.6, 0.6)));
    const child = sim.spawn(
      litter.alleles,
      k * ALLELES_PER_GENOME,
      litter.delet[2 * k] as number,
      litter.delet[2 * k + 1] as number,
      litter.species,
      o.lineage[f] as number,
      x,
      y,
      {
        adult: false,
        generation: litter.generation,
        motherId: id,
        fatherId: litter.fatherId,
        motherIdx: f,
        birthMassFrac: frac,
        macro: (litter.macro[k] as number) >= 0,
      },
    );
    // Newborn deleterious load lowers juvenile survival.
    const viab = o.derived[child * DERIVED_COUNT + D.Viability] as number;
    o.health[child] = viab;
    born++;
    if ((litter.macro[k] as number) >= 0)
      sim.moments.macromutant(sim, child, litter.macro[k] as number);
  }
  o.cooldownUntil[f] = sim.tick + cfg.reproduction.cooldown;
  sim.stats.onLitter(f, born, litter.count);
}
