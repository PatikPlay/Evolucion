import { T } from '../genetics/traits';

/** Emergent capabilities: appear when a combination of traits crosses thresholds. */
export const enum Cap {
  Swim = 1 << 0,
  Climb = 1 << 1,
  Glide = 1 << 2,
  Dig = 1 << 3,
  PackHunt = 1 << 4,
  Herd = 1 << 5,
  Hibernate = 1 << 6,
  Aposematic = 1 << 7,
  Camouflage = 1 << 8,
  Nocturnal = 1 << 9,
  Store = 1 << 10,
  Migrate = 1 << 11,
}

export interface CapabilityDef {
  readonly key: string;
  readonly bit: number;
  /** All conditions must hold: [trait, min] (or max when `max` is true). */
  readonly needs: ReadonlyArray<{ trait: T; min?: number; max?: number }>;
  /** Optional adult mass limit. */
  readonly maxMass?: number;
}

export const CAPABILITIES: readonly CapabilityDef[] = [
  { key: 'swim', bit: Cap.Swim, needs: [{ trait: T.Fins, min: 0.5 }, { trait: T.Elongation, min: 0.4 }] },
  { key: 'climb', bit: Cap.Climb, needs: [{ trait: T.Prehensile, min: 0.55 }], maxMass: 9 },
  { key: 'glide', bit: Cap.Glide, needs: [{ trait: T.Membranes, min: 0.5 }], maxMass: 5 },
  { key: 'dig', bit: Cap.Dig, needs: [{ trait: T.LegStrength, min: 0.62 }, { trait: T.Territoriality, min: 0.5 }] },
  {
    key: 'packHunt',
    bit: Cap.PackHunt,
    needs: [
      { trait: T.Sociability, min: 0.55 },
      { trait: T.Aggression, min: 0.55 },
      { trait: T.Brain, min: 0.45 },
      { trait: T.Carnivory, min: 0.5 },
    ],
  },
  { key: 'herd', bit: Cap.Herd, needs: [{ trait: T.Sociability, min: 0.6 }, { trait: T.Carnivory, max: 0.4 }] },
  { key: 'hibernate', bit: Cap.Hibernate, needs: [{ trait: T.FatReserves, min: 0.6 }, { trait: T.Metabolism, max: 0.42 }] },
  { key: 'aposematic', bit: Cap.Aposematic, needs: [{ trait: T.ToxinProduction, min: 0.55 }, { trait: T.Conspicuous, min: 0.6 }] },
  { key: 'camouflage', bit: Cap.Camouflage, needs: [{ trait: T.Conspicuous, max: 0.28 }, { trait: T.Fear, min: 0.5 }] },
  { key: 'nocturnal', bit: Cap.Nocturnal, needs: [{ trait: T.EyeSize, min: 0.55 }, { trait: T.Nocturnality, min: 0.6 }] },
  { key: 'store', bit: Cap.Store, needs: [{ trait: T.Brain, min: 0.55 }, { trait: T.Territoriality, min: 0.55 }] },
  { key: 'migrate', bit: Cap.Migrate, needs: [{ trait: T.Curiosity, min: 0.55 }, { trait: T.Brain, min: 0.5 }] },
];

export const CAPABILITY_COUNT = CAPABILITIES.length;

export function computeCapabilities(pheno: Float32Array, off: number, adultMass: number): number {
  let bits = 0;
  for (const c of CAPABILITIES) {
    if (c.maxMass !== undefined && adultMass > c.maxMass) continue;
    let ok = true;
    for (const n of c.needs) {
      const v = pheno[off + n.trait] as number;
      if ((n.min !== undefined && v < n.min) || (n.max !== undefined && v > n.max)) {
        ok = false;
        break;
      }
    }
    if (ok) bits |= c.bit;
  }
  return bits;
}
