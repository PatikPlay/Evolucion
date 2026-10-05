/** Behaviours an organism can be engaged in. Also drives the client's animation state. */
export const enum Act {
  Rest = 0,
  Explore,
  Graze,
  Drink,
  Flee,
  Hunt,
  Forage,
  Scavenge,
  Court,
  FollowGroup,
  Defend,
  CareYoung,
  Hide,
  Dig,
  Store,
  Migrate,
  Sleep,
  Hibernate,
  Fight,
}

export const ACT_COUNT = 19;

export const ACT_KEYS = [
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

/** Bit flags describing an organism's situation (also used for animation). */
export const enum Flag {
  Swimming = 1 << 0,
  Climbing = 1 << 1,
  Gliding = 1 << 2,
  Burrowed = 1 << 3,
  Hidden = 1 << 4,
  Hibernating = 1 << 5,
  Pregnant = 1 << 6,
  Infected = 1 << 7,
  Macromutant = 1 << 8,
  Limping = 1 << 9,
  Migrant = 1 << 10,
  Enclosed = 1 << 11,
  /** Has already left its birthplace (natal dispersal done). */
  Dispersed = 1 << 12,
}

/** Causes of death, recorded for the notebook and the final reveal. */
export const enum Death {
  Starvation = 0,
  Thirst,
  Predation,
  Cold,
  Heat,
  Disease,
  OldAge,
  Combat,
  Drowning,
  Toxin,
  Culled,
}

export const DEATH_CAUSES = ['starvation', 'thirst', 'predation', 'cold', 'heat', 'disease', 'oldAge', 'combat', 'drowning', 'toxin', 'culled'] as const;
export const DEATH_COUNT = 11;

/** Food categories, for digestion and diet statistics. */
export const enum Food {
  Grass = 0,
  Browse,
  Fruit,
  Canopy,
  Algae,
  Meat,
  Insects,
  SmallPrey,
  Fish,
}
export const FOOD_COUNT = 9;
export const FOOD_KEYS = ['grass', 'browse', 'fruit', 'canopy', 'algae', 'meat', 'insects', 'smallPrey', 'fish'] as const;
