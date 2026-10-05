import type { SimConfig } from '../config';
import { T, legsFromTrait, massFromTrait, metabolicRateFromTrait } from '../genetics/traits';
import { D, DERIVED_COUNT, type OrganismStore } from './store';
import { TRAIT_COUNT } from '../genetics/traits';
import { computeCapabilities } from './capabilities';

const LEG_FACTOR = [0.45, 0.85, 1.0, 0.95];

/** Computes the derived quantities of organism `i` from its phenotype. */
export function computeDerived(s: OrganismStore, i: number, cfg: SimConfig): void {
  const p = s.pheno;
  const o = i * TRAIT_COUNT;
  const d = s.derived;
  const q = i * DERIVED_COUNT;
  const tr = (t: T) => p[o + t] as number;
  const adultMass = massFromTrait(tr(T.Mass));
  const legs = legsFromTrait(tr(T.LegCount));
  const metab = tr(T.Metabolism);
  const sizeRatio = adultMass / 4;

  d[q + D.AdultMassPotential] = adultMass;
  d[q + D.Legs] = legs;
  d[q + D.MaxSpeed] =
    cfg.organisms.baseSpeed *
    (LEG_FACTOR[legs / 2] ?? 1) *
    (0.45 + 1.1 * tr(T.LegLength)) *
    (1 - 0.45 * tr(T.Armor)) *
    (0.8 + 0.4 * metab) *
    (1 - 0.2 * tr(T.Fins)) *
    (1 - 0.1 * tr(T.Membranes));
  d[q + D.Strength] = (0.6 + 0.6 * tr(T.LegStrength)) * (0.75 + 0.5 * tr(T.Aggression));
  d[q + D.Perception] =
    cfg.organisms.basePerception * (0.6 + 0.9 * tr(T.EyeSize)) +
    2 * tr(T.Smell) +
    1.5 * tr(T.Hearing);
  d[q + D.NightPerception] =
    (d[q + D.Perception] as number) * (0.25 + 0.75 * tr(T.NightVision)) +
    1.5 * tr(T.Smell) +
    1.5 * tr(T.Hearing);
  d[q + D.Maturity] =
    cfg.reproduction.maturityBase *
    (0.6 + 1.2 * tr(T.Growth)) *
    Math.pow(sizeRatio, 0.25) *
    (1 + 0.6 * tr(T.Brain));
  d[q + D.Lifespan] =
    cfg.aging.lifespanBase *
    (0.6 + 1.2 * tr(T.Longevity)) *
    Math.pow(sizeRatio, 0.2) *
    (1.35 - 0.6 * metab);
  const up = cfg.organisms.upkeep;
  d[q + D.UpkeepMult] =
    1 +
    up.brain * Math.pow(tr(T.Brain), 1.5) +
    up.armor * tr(T.Armor) +
    up.toxin * tr(T.ToxinProduction) +
    up.spines * tr(T.Spines) +
    up.fins * tr(T.Fins) +
    up.membranes * tr(T.Membranes);
  const logSize = Math.log2(sizeRatio);
  // Thermal comfort. Coat and body size are the main (visible) levers; Allen's
  // rule: long tails and legs lose heat in the cold and shed it in the heat.
  const extremities = 2.5 * tr(T.Tail) + 2 * tr(T.LegLength);
  d[q + D.ComfortLow] =
    cfg.thermal.comfortLowBase -
    9 * tr(T.ColdTolerance) -
    15 * tr(T.Fur) -
    3 * tr(T.FatReserves) -
    3 * logSize +
    extremities;
  d[q + D.ComfortHigh] =
    cfg.thermal.comfortHighBase +
    12 * tr(T.HeatTolerance) -
    8 * tr(T.Fur) -
    1.5 * logSize +
    extremities;
  d[q + D.Visibility] =
    (0.45 + 0.7 * tr(T.Conspicuous)) * Math.min(1.8, Math.max(0.5, Math.pow(sizeRatio, 0.3)));
  d[q + D.Endurance] = 0.5 + 0.7 * metab + 0.3 * tr(T.LegStrength);
  d[q + D.Plasticity] = 0.25 + 0.75 * tr(T.Brain);
  d[q + D.Viability] = Math.pow(1 - cfg.genetics.deleteriousPenalty, s.delLoad[i] as number);
  d[q + D.MetabolicRate] = metabolicRateFromTrait(metab);
  const carn = tr(T.Carnivory);
  const plant = 0.55 * (1 - 0.88 * carn);
  // Jarman–Bell: bigger guts retain food longer and extract more from fibre.
  const gut = Math.min(1.4, Math.max(0.6, 1 + 0.18 * Math.log2(sizeRatio)));
  const fiber = tr(T.FiberDigestion);
  d[q + D.EffGrass] = plant * (0.35 + 0.65 * fiber) * gut;
  d[q + D.EffBrowse] =
    plant * (0.5 + 0.5 * fiber) * (0.45 + 0.55 * tr(T.PlantToxinTolerance)) * gut;
  d[q + D.EffFruit] = 0.72 - 0.3 * carn;
  d[q + D.EffCanopy] = plant * (0.4 + 0.6 * fiber) * gut;
  d[q + D.EffAlgae] = plant * (0.12 + 0.88 * tr(T.AlgaeDigestion));
  d[q + D.EffMeat] = 0.2 + 0.7 * carn;
  d[q + D.ThirstMult] = 1 - 0.15 * tr(T.WaterEfficiency);
  s.capabilities[i] = computeCapabilities(p, o, adultMass);
  refreshMass(s, i, cfg);
}

/** Refreshes mass-dependent derived values (called when a juvenile grows). */
export function refreshMass(s: OrganismStore, i: number, cfg: SimConfig): void {
  const q = i * DERIVED_COUNT;
  const m = s.mass[i] as number;
  s.derived[q + D.M075] = Math.pow(m, 0.75);
  const fat = s.pheno[i * TRAIT_COUNT + T.FatReserves] as number;
  s.derived[q + D.MaxEnergy] =
    m * (cfg.organisms.reservePerMass + cfg.organisms.reserveFatBonus * fat);
}
