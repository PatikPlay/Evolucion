import type { SpeciesTemplate } from './templates';

/** A fast, medium-sized hunter (the "native predator" and the selection experiments). */
export const PREDATOR_TEMPLATE: SpeciesTemplate = {
  key: 'predator',
  mass: 6,
  traits: {
    carnivory: 0.88,
    fiberDigestion: 0.2,
    legLength: 0.5,
    legStrength: 0.6,
    aggression: 0.72,
    fear: 0.2,
    metabolism: 0.62,
    eyeSize: 0.6,
    smell: 0.65,
    litterSize: 0.2,
    investment: 0.6,
    brain: 0.4,
    armor: 0.08,
    conspicuous: 0.3,
    hue: 0.15,
    sociability: 0.3,
    territoriality: 0.5,
    toxinResistance: 0.35,
    parentalCare: 0.6,
  },
};
