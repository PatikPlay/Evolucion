/**
 * Every simulation balance parameter lives here, commented. Units:
 *  - distance: cells; time: ticks (400 per year);
 *  - energy and plant/meat biomass share one unit, the "food unit" (fu);
 *  - temperature: degrees Celsius.
 * Game-level parameters (Influence, scoring…) live in @linaje/game.
 */
export const DEFAULT_SIM_CONFIG = {
  world: {
    width: 96,
    height: 96,
    /** Fraction of cells that start as water (lakes, ponds and river). */
    waterFraction: 0.1,
    /** Fraction of water cells that are deep (impassable for non-swimmers). */
    deepFraction: 0.35,
    riverChance: 0.75,
    minPonds: 3,
    maxPonds: 6,
    /**
     * Target sum over cells of the yearly plant productivity estimate, per cell.
     * Every parcel is scaled to it so ecological capacity is equivalent.
     */
    targetProductivityPerCell: 6,
  },
  climate: {
    /** Annual mean temperature at sea level. */
    baseTemperature: 12,
    /** Degrees lost from the lowest to the highest elevation. */
    elevationCooling: 9,
    /** Half the summer–winter swing. */
    seasonalAmplitude: 12,
    nightCooling: 3,
    /** Seasonal moisture swing (fraction): wetter spring, drier late summer. */
    moistureSwing: 0.2,
  },
  vegetation: {
    /** Cells are updated in interleaved blocks; each cell every `updateStride` ticks. */
    updateStride: 8,
    /** Carrying capacity (fu) at fertility 1 and full moisture, per type. */
    capacity: { grass: 10, shrub: 12, tree: 30, algae: 9 },
    /** Logistic growth rate per tick in ideal conditions. */
    growthRate: { grass: 0.02, shrub: 0.009, tree: 0.0035, algae: 0.025 },
    /** Natural reseeding as a fraction of K per tick when nearly bare. */
    reseed: 0.0015,
    /** Below-ground reserve (fraction of K) that keeps regrowth going after grazing. */
    rootStock: 0.25,
    /** Fruit produced per tick per fu of shrub/tree biomass in summer and autumn. */
    fruitRate: 0.0018,
    fruitDecay: 0.012,
    fruitMax: 6,
    /** Temperature window for growth. */
    growMinTemp: 3,
    growOptTemp: 16,
    growMaxTemp: 34,
  },
  fauna: {
    /** Background fauna densities are kept per block of `blockSize`×`blockSize` cells. */
    blockSize: 4,
    updateStride: 10,
    insectCapacityPerPlant: 0.06,
    smallHerbCapacityPerGrass: 0.045,
    fishCapacityPerWaterCell: 0.9,
    insectGrowth: 0.02,
    smallHerbGrowth: 0.006,
    fishGrowth: 0.01,
    /** Plants eaten by insects per fu of insects per tick (matters during plagues). */
    insectGrazing: 0.01,
  },
  organisms: {
    initialCapacity: 2048,
    /** Ticks between utility re-evaluations. */
    thinkInterval: 6,
    /** Basal metabolism coefficient (fu per tick per mass^0.75). */
    basalCoeff: 0.0105,
    /** Energy reserve per unit of mass: base + fat bonus. */
    reservePerMass: 0.8,
    reserveFatBonus: 2.6,
    /** Movement cost per tick: coeff · mass · speed (cells/tick) · (speed/vmax). */
    moveCoeff: 0.025,
    /** Upkeep multipliers (fraction of basal metabolism at trait = 1). */
    upkeep: { brain: 0.55, armor: 0.3, toxin: 0.25, spines: 0.12, fins: 0.08, membranes: 0.08 },
    /** Bite size: fu per tick per mass^0.75. */
    biteCoeff: 0.12,
    /** Hydration loss per tick at rest in mild weather. */
    thirstRate: 0.0025,
    drinkRate: 0.12,
    fatigueRunGain: 0.02,
    fatigueRecover: 0.012,
    /** Health regeneration per tick when fed. */
    healRate: 0.004,
    /** Base walking speed fraction of vmax. */
    walkFraction: 0.55,
    /** Base maximum speed in cells/tick for an average body plan. */
    baseSpeed: 0.24,
    /** Base perception radius in cells. */
    basePerception: 6,
    maxNeighbors: 12,
    /** Young adults settle away from their birthplace. */
    natalDispersal: 1,
  },
  reproduction: {
    /** Maturity in ticks for a 4-mass, mid-growth, small-brained organism. */
    maturityBase: 150,
    gestationBase: 22,
    /** Birth mass as a fraction of adult mass: base + investment bonus. */
    birthMassBase: 0.05,
    birthMassInvestment: 0.13,
    /** Energy fraction (of max) needed to breed. */
    breedEnergy: 0.45,
    maleBreedEnergy: 0.35,
    cooldown: 35,
    /** Extra energy paid per unit of offspring energy (inefficiency). */
    costOverhead: 1.1,
    /** Distance to complete mating. */
    mateRange: 1.2,
    /** Recognition-locus distance above which mating becomes unlikely. */
    compatibilityScale: 1.6,
  },
  genetics: {
    /** Per-allele mutation probability per birth. */
    mutationRate: 0.012,
    mutationSd: 0.22,
    recognitionMutationMult: 3,
    deleteriousMutationRate: 0.0006,
    macroMutationRate: 1 / 1500,
    macroMutationSize: 3,
    /** Cryptic loci contribute this fraction of their effect under normal (canalised) conditions. */
    canalisation: 0.15,
    /** Standing variation (allele sd) in founder populations. */
    standingVariation: 0.35,
    /** Viability lost per homozygous deleterious locus. */
    deleteriousPenalty: 0.14,
  },
  predation: {
    reach: 0.7,
    /** Base chance multiplier of a successful kill once in reach. */
    killBase: 0.75,
    /** Meat (fu) per unit of prey mass. */
    meatPerMass: 1.6,
    carcassDecay: 0.006,
    giveUpDistanceFactor: 1.6,
    /** Toxin dose above which an attacker is harmed. */
    toxinThreshold: 0.15,
    toxinDamage: 0.9,
    aversionLearning: 0.6,
    aversionDecay: 0.0004,
  },
  /**
   * Ambient predators (raptors, snakes): part of the background fauna, not
   * individuals. They take small, visible, careless animals, so being small
   * is never free.
   */
  ambientPredation: {
    /** Hazard per tick for a fully exposed, tiny, careless animal. */
    base: 0.0009,
    /** Mass at which the size protection halves the risk. */
    halfMass: 1.6,
  },
  thermal: {
    comfortLowBase: 13,
    comfortHighBase: 27,
    /** Extra metabolism per degree below the comfort zone, as a fraction of basal. */
    coldCost: 0.08,
    heatThirst: 0.0007,
    damagePerDegree: 0.0018,
    damageMargin: 6,
  },
  disease: {
    /** Spontaneous outbreak chance per think for an individual with many close neighbours. */
    spontaneous: 0.00002,
    contactRange: 1.6,
    recoveryImmunity: true,
  },
  aging: {
    lifespanBase: 900,
    senescenceStart: 0.75,
  },
  stats: {
    interval: 40,
  },
};

export type SimConfig = typeof DEFAULT_SIM_CONFIG;

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export function mergeConfig(overrides?: DeepPartial<SimConfig>): SimConfig {
  return deepMerge(structuredClone(DEFAULT_SIM_CONFIG), overrides ?? {}) as SimConfig;
}

function deepMerge(target: Record<string, unknown>, src: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(src)) {
    const v = src[key];
    if (v === undefined) continue;
    const t = target[key];
    if (v && typeof v === 'object' && !Array.isArray(v) && t && typeof t === 'object') {
      deepMerge(t as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      target[key] = v;
    }
  }
  return target;
}
