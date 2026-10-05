/**
 * Phenotypic traits. Every trait is expressed in [0, 1] (a logistic function
 * of its genetic value); `traitScale` maps some of them to physical units.
 */
export const enum T {
  Mass = 0,
  Elongation,
  LegLength,
  LegCount,
  LegStrength,
  Prehensile,
  Fins,
  Membranes,
  Armor,
  Spines,
  Tail,
  Fur,
  Hue,
  Lightness,
  Conspicuous,
  Spots,
  Stripes,
  EyeSize,
  NightVision,
  Smell,
  Hearing,
  Metabolism,
  ColdTolerance,
  HeatTolerance,
  FatReserves,
  Longevity,
  WaterEfficiency,
  Carnivory,
  FiberDigestion,
  PlantToxinTolerance,
  AlgaeDigestion,
  ToxinProduction,
  ToxinResistance,
  ImmunityA,
  ImmunityB,
  ImmunityC,
  ImmunityD,
  Aggression,
  Fear,
  Sociability,
  Curiosity,
  Territoriality,
  Nocturnality,
  ParentalCare,
  Brain,
  Growth,
  LitterSize,
  Investment,
  PrefConspicuous,
  PrefSize,
}

export const TRAIT_COUNT = 50;

export type TraitGroup =
  | 'morphology'
  | 'appearance'
  | 'senses'
  | 'physiology'
  | 'diet'
  | 'chemical'
  | 'immunity'
  | 'behavior'
  | 'cognition'
  | 'reproduction';

export interface TraitInfo {
  readonly key: string;
  readonly group: TraitGroup;
  /** Visible at a glance: may be sent (quantised) to clients as drawing parameters. */
  readonly visible: boolean;
}

export const TRAITS: readonly TraitInfo[] = [
  { key: 'mass', group: 'morphology', visible: true },
  { key: 'elongation', group: 'morphology', visible: true },
  { key: 'legLength', group: 'morphology', visible: true },
  { key: 'legCount', group: 'morphology', visible: true },
  { key: 'legStrength', group: 'morphology', visible: true },
  { key: 'prehensile', group: 'morphology', visible: true },
  { key: 'fins', group: 'morphology', visible: true },
  { key: 'membranes', group: 'morphology', visible: true },
  { key: 'armor', group: 'morphology', visible: true },
  { key: 'spines', group: 'morphology', visible: true },
  { key: 'tail', group: 'morphology', visible: true },
  { key: 'fur', group: 'morphology', visible: true },
  { key: 'hue', group: 'appearance', visible: true },
  { key: 'lightness', group: 'appearance', visible: true },
  { key: 'conspicuous', group: 'appearance', visible: true },
  { key: 'spots', group: 'appearance', visible: true },
  { key: 'stripes', group: 'appearance', visible: true },
  { key: 'eyeSize', group: 'senses', visible: true },
  { key: 'nightVision', group: 'senses', visible: false },
  { key: 'smell', group: 'senses', visible: false },
  { key: 'hearing', group: 'senses', visible: false },
  { key: 'metabolism', group: 'physiology', visible: false },
  { key: 'coldTolerance', group: 'physiology', visible: false },
  { key: 'heatTolerance', group: 'physiology', visible: false },
  { key: 'fatReserves', group: 'physiology', visible: false },
  { key: 'longevity', group: 'physiology', visible: false },
  { key: 'waterEfficiency', group: 'physiology', visible: false },
  { key: 'carnivory', group: 'diet', visible: false },
  { key: 'fiberDigestion', group: 'diet', visible: false },
  { key: 'plantToxinTolerance', group: 'diet', visible: false },
  { key: 'algaeDigestion', group: 'diet', visible: false },
  { key: 'toxinProduction', group: 'chemical', visible: false },
  { key: 'toxinResistance', group: 'chemical', visible: false },
  { key: 'immunityA', group: 'immunity', visible: false },
  { key: 'immunityB', group: 'immunity', visible: false },
  { key: 'immunityC', group: 'immunity', visible: false },
  { key: 'immunityD', group: 'immunity', visible: false },
  { key: 'aggression', group: 'behavior', visible: false },
  { key: 'fear', group: 'behavior', visible: false },
  { key: 'sociability', group: 'behavior', visible: false },
  { key: 'curiosity', group: 'behavior', visible: false },
  { key: 'territoriality', group: 'behavior', visible: false },
  { key: 'nocturnality', group: 'behavior', visible: false },
  { key: 'parentalCare', group: 'behavior', visible: false },
  { key: 'brain', group: 'cognition', visible: false },
  { key: 'growth', group: 'reproduction', visible: false },
  { key: 'litterSize', group: 'reproduction', visible: false },
  { key: 'investment', group: 'reproduction', visible: false },
  { key: 'prefConspicuous', group: 'reproduction', visible: false },
  { key: 'prefSize', group: 'reproduction', visible: false },
];

export const TRAIT_INDEX: Readonly<Record<string, number>> = Object.fromEntries(TRAITS.map((t, i) => [t.key, i]));

export const MIN_MASS = 0.4;
export const MAX_MASS = 40;
const LOG_MIN_MASS = Math.log(MIN_MASS);
const LOG_MASS_RANGE = Math.log(MAX_MASS) - LOG_MIN_MASS;

/** Adult body mass (genetic potential) from the [0,1] trait. */
export function massFromTrait(v: number): number {
  return Math.exp(LOG_MIN_MASS + v * LOG_MASS_RANGE);
}

export function traitFromMass(mass: number): number {
  return (Math.log(mass) - LOG_MIN_MASS) / LOG_MASS_RANGE;
}

export function legsFromTrait(v: number): number {
  return v < 0.12 ? 0 : v < 0.3 ? 2 : v < 0.82 ? 4 : 6;
}

export function litterFromTrait(v: number): number {
  return 1 + Math.floor(v * 7.99);
}

export function metabolicRateFromTrait(v: number): number {
  return 0.6 + 0.9 * v;
}
