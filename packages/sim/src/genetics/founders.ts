import type { Rng } from '../rng';
import { BASE_TRAITS, type SpeciesTemplate } from './templates';

/**
 * Random founder templates with an equivalent budget. Costly traits are
 * allocated as a zero-sum bundle around the base organism: a founder that is
 * big and armoured pays with smaller litters or a smaller brain. Appearance
 * and temperament vary freely. No founder is objectively better; each fits
 * some parcels better than others.
 */

/** Costly traits and their weight in the budget (how much advantage a unit buys). */
const COSTLY: ReadonlyArray<readonly [string, number, number?]> = [
  // [trait, budget weight, spread multiplier]: fecundity and size swing fitness the most.
  ['mass', 1.0, 0.55],
  ['armor', 0.8],
  ['spines', 0.6],
  ['legLength', 0.9],
  ['legStrength', 0.6],
  ['brain', 1.0],
  ['metabolism', 0.7],
  ['toxinProduction', 0.7],
  ['fur', 0.5],
  ['fatReserves', 0.6],
  ['litterSize', 1.0, 0.45],
  ['investment', 0.8],
  ['eyeSize', 0.5],
  ['longevity', 0.7],
  ['coldTolerance', 0.6],
  ['heatTolerance', 0.6],
  ['fiberDigestion', 0.6],
];

/** Free-varying traits: [key, min, max]. */
const FREE: ReadonlyArray<readonly [string, number, number]> = [
  ['hue', 0.05, 0.95],
  ['lightness', 0.2, 0.75],
  ['conspicuous', 0.15, 0.6],
  ['spots', 0.05, 0.7],
  ['stripes', 0.05, 0.7],
  ['tail', 0.15, 0.85],
  ['elongation', 0.25, 0.7],
  ['aggression', 0.15, 0.6],
  ['fear', 0.3, 0.75],
  ['sociability', 0.2, 0.75],
  ['curiosity', 0.2, 0.7],
  ['territoriality', 0.15, 0.65],
  ['nocturnality', 0.05, 0.6],
  ['parentalCare', 0.25, 0.75],
  ['prefConspicuous', 0.2, 0.6],
  ['prefSize', 0.2, 0.6],
  ['carnivory', 0.05, 0.35],
  ['prehensile', 0.08, 0.4],
  ['fins', 0.04, 0.3],
  ['membranes', 0.04, 0.3],
  ['smell', 0.3, 0.65],
  ['hearing', 0.3, 0.65],
];

/** How far costly traits stray from the base organism (in trait units). */
const SPREAD = 0.16;

export function randomFounderTemplate(rng: Rng, key = 'founder'): SpeciesTemplate {
  const traits: Record<string, number> = {};
  for (const [k, lo, hi] of FREE) traits[k] = lo + rng.float() * (hi - lo);
  // Zero-sum allocation of the costly traits.
  const deltas = COSTLY.map(() => rng.gaussian(0, 1));
  const wsum = COSTLY.reduce((a, [, w]) => a + w, 0);
  const mean = deltas.reduce((a, d, k) => a + d * (COSTLY[k]?.[1] ?? 1), 0) / wsum;
  COSTLY.forEach(([k, , spreadMult], idx) => {
    const base = BASE_TRAITS[k] ?? 0.5;
    const d = ((deltas[idx] as number) - mean) * SPREAD * (spreadMult ?? 1);
    traits[k] = Math.min(0.92, Math.max(0.08, base + d));
  });
  // Body plans: mostly four legs, sometimes two or six.
  const r = rng.float();
  traits.legCount = r < 0.1 ? 0.22 : r < 0.18 ? 0.88 : 0.55;
  return { key, traits };
}
