/**
 * Visible appearance of a creature, quantised. These are the ONLY phenotype
 * values a client ever receives: morphology, colour, pattern, eyes and coat.
 * Each parameter is an integer level in [0, VISUAL_LEVELS).
 */
export const VISUAL_LEVELS = 16;

/** Order of the parameters inside `CreatureDef.v`. */
export const VISUAL_KEYS = [
  'size',
  'elongation',
  'legLength',
  'legCount',
  'legStrength',
  'prehensile',
  'fins',
  'membranes',
  'armor',
  'spines',
  'tail',
  'fur',
  'hue',
  'lightness',
  'conspicuous',
  'spots',
  'stripes',
  'eyes',
] as const;

export type VisualKey = (typeof VISUAL_KEYS)[number];
export const VISUAL_COUNT = VISUAL_KEYS.length;

/** Index of each visual parameter in `CreatureDef.v`. */
export const V = Object.fromEntries(VISUAL_KEYS.map((k, i) => [k, i])) as {
  readonly [K in VisualKey]: number;
};

/**
 * A creature's drawing definition, sent once per creature.
 * `legCount` is stored as legs / 2 (0–3).
 */
export interface CreatureDef {
  /** Creature id (stable for its whole life). */
  readonly id: number;
  /** Species id (the phylogenetic tree's leaves are visible to everyone). */
  readonly sp: number;
  /** Owner slot: player index 0–5, or 255 for NPC/wild species. */
  readonly own: number;
  /** Quantised visual parameters, VISUAL_COUNT integers. */
  readonly v: readonly number[];
}

/** Encodes a [0,1] value into a visual level. */
export function quantise(v: number): number {
  const q = Math.floor(v * VISUAL_LEVELS);
  return q < 0 ? 0 : q >= VISUAL_LEVELS ? VISUAL_LEVELS - 1 : q;
}

/** Centre of a visual level, back in [0,1]. */
export function dequantise(level: number): number {
  return (level + 0.5) / VISUAL_LEVELS;
}

/** Visible states carried per frame. */
export const enum FrameFlag {
  Juvenile = 1 << 0,
  Swimming = 1 << 1,
  Climbing = 1 << 2,
  Burrowed = 1 << 3,
  Hidden = 1 << 4,
  Limping = 1 << 5,
  Pregnant = 1 << 6,
  Thin = 1 << 7,
}

/** Animation states (what the creature is visibly doing). Mirrors the simulation's behaviours. */
export const ANIM_KEYS = [
  'rest',
  'explore',
  'graze',
  'drink',
  'flee',
  'hunt',
  'forage',
  'scavenge',
  'court',
  'followGroup',
  'defend',
  'careYoung',
  'hide',
  'dig',
  'store',
  'migrate',
  'sleep',
  'hibernate',
  'fight',
] as const;
export type AnimKey = (typeof ANIM_KEYS)[number];
