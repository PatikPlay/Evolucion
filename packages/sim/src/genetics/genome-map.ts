import { T } from './traits';

export type LocusKind = 'trait' | 'pleiotropic' | 'latent' | 'cryptic' | 'recognition';

export interface LocusDef {
  readonly key: string;
  readonly kind: LocusKind;
  /** [trait, weight] pairs: the locus value times the weight is added to the trait's genetic value. */
  readonly effects: ReadonlyArray<readonly [T, number]>;
  /**
   * Dominance of the higher allele: 0.5 = additive, >0.5 = the higher allele
   * dominates (gain-of-function), <0.5 = the higher allele is recessive.
   */
  readonly dominance?: number;
  /** Eligible target of rare macromutations (big-effect jumps). */
  readonly macro?: 'up' | 'both';
}

/**
 * The genome map: 71 diploid continuous loci. Data, not code: adding a locus
 * here changes the species without touching the simulation core.
 */
export const LOCI: readonly LocusDef[] = [
  // --- Trait loci (polygenic where several share a trait) ---
  { key: 'mass1', kind: 'trait', effects: [[T.Mass, 0.8]] },
  { key: 'mass2', kind: 'trait', effects: [[T.Mass, 0.8]] },
  { key: 'elongation', kind: 'trait', effects: [[T.Elongation, 1]], macro: 'both' },
  { key: 'legLength1', kind: 'trait', effects: [[T.LegLength, 0.8]] },
  { key: 'legLength2', kind: 'trait', effects: [[T.LegLength, 0.8]] },
  { key: 'legCount', kind: 'trait', effects: [[T.LegCount, 1.2]], dominance: 0.7, macro: 'both' },
  { key: 'legStrength', kind: 'trait', effects: [[T.LegStrength, 1]] },
  { key: 'prehensile', kind: 'trait', effects: [[T.Prehensile, 1]], dominance: 0.65, macro: 'up' },
  { key: 'fins', kind: 'trait', effects: [[T.Fins, 1.2]], dominance: 0.7, macro: 'up' },
  { key: 'membranes', kind: 'trait', effects: [[T.Membranes, 1.2]], dominance: 0.7, macro: 'up' },
  { key: 'armor', kind: 'trait', effects: [[T.Armor, 1]], macro: 'up' },
  { key: 'spines', kind: 'trait', effects: [[T.Spines, 1.1]], dominance: 0.65, macro: 'up' },
  { key: 'tail', kind: 'trait', effects: [[T.Tail, 1]], macro: 'both' },
  { key: 'fur', kind: 'trait', effects: [[T.Fur, 1]] },
  { key: 'hue', kind: 'trait', effects: [[T.Hue, 1]], macro: 'both' },
  // Recessive high allele: a macromutation can produce albinos once two carriers meet.
  { key: 'lightness', kind: 'trait', effects: [[T.Lightness, 1]], dominance: 0.2, macro: 'up' },
  { key: 'conspicuous', kind: 'trait', effects: [[T.Conspicuous, 1]] },
  { key: 'spots', kind: 'trait', effects: [[T.Spots, 1]], macro: 'up' },
  { key: 'stripes', kind: 'trait', effects: [[T.Stripes, 1]], macro: 'up' },
  {
    key: 'eyeSize',
    kind: 'trait',
    effects: [
      [T.EyeSize, 1],
      [T.NightVision, 0.4],
    ],
  },
  { key: 'nightVision', kind: 'trait', effects: [[T.NightVision, 0.9]] },
  { key: 'smell', kind: 'trait', effects: [[T.Smell, 1]] },
  { key: 'hearing', kind: 'trait', effects: [[T.Hearing, 1]] },
  { key: 'metabolism', kind: 'trait', effects: [[T.Metabolism, 0.8]] },
  { key: 'coldTolerance', kind: 'trait', effects: [[T.ColdTolerance, 1]] },
  { key: 'heatTolerance', kind: 'trait', effects: [[T.HeatTolerance, 1]] },
  { key: 'fatReserves', kind: 'trait', effects: [[T.FatReserves, 1]] },
  { key: 'longevity', kind: 'trait', effects: [[T.Longevity, 1]] },
  { key: 'carnivory1', kind: 'trait', effects: [[T.Carnivory, 0.8]] },
  {
    key: 'carnivory2',
    kind: 'trait',
    effects: [
      [T.Carnivory, 0.8],
      [T.FiberDigestion, -0.3],
    ],
  },
  { key: 'fiberDigestion', kind: 'trait', effects: [[T.FiberDigestion, 1]] },
  { key: 'plantToxinTolerance', kind: 'trait', effects: [[T.PlantToxinTolerance, 1]] },
  { key: 'toxinProduction', kind: 'trait', effects: [[T.ToxinProduction, 1]] },
  { key: 'toxinResistance', kind: 'trait', effects: [[T.ToxinResistance, 1]] },
  { key: 'immunityA', kind: 'trait', effects: [[T.ImmunityA, 1]] },
  { key: 'immunityB', kind: 'trait', effects: [[T.ImmunityB, 1]] },
  { key: 'immunityC', kind: 'trait', effects: [[T.ImmunityC, 1]] },
  { key: 'immunityD', kind: 'trait', effects: [[T.ImmunityD, 1]] },
  { key: 'aggression', kind: 'trait', effects: [[T.Aggression, 1]] },
  { key: 'fear', kind: 'trait', effects: [[T.Fear, 1]] },
  { key: 'sociability', kind: 'trait', effects: [[T.Sociability, 1]] },
  { key: 'curiosity', kind: 'trait', effects: [[T.Curiosity, 1]] },
  { key: 'territoriality', kind: 'trait', effects: [[T.Territoriality, 1]] },
  { key: 'nocturnality', kind: 'trait', effects: [[T.Nocturnality, 1]] },
  { key: 'parentalCare', kind: 'trait', effects: [[T.ParentalCare, 1]] },
  { key: 'brain', kind: 'trait', effects: [[T.Brain, 0.9]] },
  { key: 'growth', kind: 'trait', effects: [[T.Growth, 0.9]] },
  { key: 'litterSize', kind: 'trait', effects: [[T.LitterSize, 1]] },
  { key: 'investment', kind: 'trait', effects: [[T.Investment, 1]] },
  { key: 'prefConspicuous', kind: 'trait', effects: [[T.PrefConspicuous, 1]] },
  { key: 'prefSize', kind: 'trait', effects: [[T.PrefSize, 1]] },

  // --- Pleiotropic loci: selecting one visible trait drags hidden ones along ---
  // Growth: bigger bodies mature later and live longer.
  {
    key: 'growthHormone',
    kind: 'pleiotropic',
    effects: [
      [T.Mass, 0.6],
      [T.Growth, 0.7],
      [T.Longevity, 0.3],
    ],
  },
  // Neural crest (Belyaev's foxes): tamer animals get spots, shorter tails and paler coats.
  {
    key: 'neuralCrest',
    kind: 'pleiotropic',
    effects: [
      [T.Fear, -0.6],
      [T.Aggression, -0.45],
      [T.Spots, 0.6],
      [T.Tail, -0.4],
      [T.Lightness, 0.3],
    ],
  },
  // Metabolic pace: faster, warmer and longer-legged, but shorter-lived.
  {
    key: 'metabolicPace',
    kind: 'pleiotropic',
    effects: [
      [T.Metabolism, 0.7],
      [T.LegLength, 0.25],
      [T.Longevity, -0.45],
      [T.ColdTolerance, 0.2],
    ],
  },
  // Pigment pathway: bright colours share machinery with toxin synthesis.
  {
    key: 'pigment',
    kind: 'pleiotropic',
    effects: [
      [T.Conspicuous, 0.7],
      [T.ToxinProduction, 0.4],
      [T.Hue, 0.3],
    ],
  },
  // Bone density: stronger legs and plates, shorter legs.
  {
    key: 'bone',
    kind: 'pleiotropic',
    effects: [
      [T.LegStrength, 0.6],
      [T.Armor, 0.5],
      [T.LegLength, -0.3],
    ],
  },
  // Neural development: bigger brains, more curiosity, slower maturation.
  {
    key: 'neural',
    kind: 'pleiotropic',
    effects: [
      [T.Brain, 0.6],
      [T.Curiosity, 0.4],
      [T.Growth, 0.3],
      [T.Sociability, 0.2],
    ],
  },

  // --- Latent loci: nearly neutral until the environment changes ---
  { key: 'waterEfficiency1', kind: 'latent', effects: [[T.WaterEfficiency, 1]] },
  {
    key: 'waterEfficiency2',
    kind: 'latent',
    effects: [
      [T.WaterEfficiency, 0.8],
      [T.HeatTolerance, 0.2],
    ],
  },
  { key: 'algaeDigestion', kind: 'latent', effects: [[T.AlgaeDigestion, 1.1]] },
  {
    key: 'detox',
    kind: 'latent',
    effects: [
      [T.PlantToxinTolerance, 0.6],
      [T.ToxinResistance, 0.35],
    ],
  },

  // --- Cryptic loci: effects buffered by canalisation, released by stress ---
  {
    key: 'crypticLimb',
    kind: 'cryptic',
    effects: [
      [T.LegLength, 0.9],
      [T.Mass, -0.3],
    ],
  },
  {
    key: 'crypticCoat',
    kind: 'cryptic',
    effects: [
      [T.Fur, 0.9],
      [T.FatReserves, 0.4],
    ],
  },
  {
    key: 'crypticDiet',
    kind: 'cryptic',
    effects: [
      [T.Carnivory, 0.8],
      [T.Aggression, 0.3],
    ],
  },
  {
    key: 'crypticSkin',
    kind: 'cryptic',
    effects: [
      [T.Membranes, 0.6],
      [T.Prehensile, 0.5],
      [T.Fins, 0.4],
    ],
  },

  // --- Mate-recognition loci: neutral, faster mutating; drive reproductive isolation ---
  { key: 'recognition1', kind: 'recognition', effects: [] },
  { key: 'recognition2', kind: 'recognition', effects: [] },
  { key: 'recognition3', kind: 'recognition', effects: [] },
  { key: 'recognition4', kind: 'recognition', effects: [] },
  { key: 'recognition5', kind: 'recognition', effects: [] },
  { key: 'recognition6', kind: 'recognition', effects: [] },
];

export const LOCUS_COUNT = LOCI.length;
export const ALLELES_PER_GENOME = LOCUS_COUNT * 2;
/** Number of biallelic recessive-deleterious loci (bits in two 32-bit haplotype masks). */
/** Recessive deleterious loci, stored as bits: DELETERIOUS_WORDS 32-bit words per haplotype. */
export const DELETERIOUS_WORDS = 2;
export const DELETERIOUS_LOCI = DELETERIOUS_WORDS * 32;
/** Uint32 words per organism (two haplotypes). */
export const DELETERIOUS_STRIDE = DELETERIOUS_WORDS * 2;

export const LOCUS_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  LOCI.map((l, i) => [l.key, i]),
);
export const RECOGNITION_LOCI: readonly number[] = LOCI.flatMap((l, i) =>
  l.kind === 'recognition' ? [i] : [],
);
export const MACRO_LOCI: readonly number[] = LOCI.flatMap((l, i) => (l.macro ? [i] : []));

/** Flattened effect table for fast expression: per locus a slice of (trait, weight) pairs. */
export interface CompiledGenomeMap {
  readonly effectStart: Int32Array;
  readonly effectTrait: Int32Array;
  readonly effectWeight: Float32Array;
  readonly dominance: Float32Array;
  readonly cryptic: Uint8Array;
}

export function compileGenomeMap(loci: readonly LocusDef[] = LOCI): CompiledGenomeMap {
  const effectStart = new Int32Array(loci.length + 1);
  const traits: number[] = [];
  const weights: number[] = [];
  const dominance = new Float32Array(loci.length);
  const cryptic = new Uint8Array(loci.length);
  loci.forEach((l, i) => {
    effectStart[i] = traits.length;
    for (const [t, w] of l.effects) {
      traits.push(t);
      weights.push(w);
    }
    dominance[i] = l.dominance ?? 0.5;
    cryptic[i] = l.kind === 'cryptic' ? 1 : 0;
  });
  effectStart[loci.length] = traits.length;
  return {
    effectStart,
    effectTrait: Int32Array.from(traits),
    effectWeight: Float32Array.from(weights),
    dominance,
    cryptic,
  };
}

export const GENOME_MAP = compileGenomeMap();
