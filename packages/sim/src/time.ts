/** Fixed-step time model. Everything in the simulation is measured in ticks. */

export const TICKS_PER_SEASON = 100;
export const SEASONS_PER_YEAR = 4;
export const TICKS_PER_YEAR = TICKS_PER_SEASON * SEASONS_PER_YEAR;
/** Night lasts NIGHT_TICKS out of every DAY_TICKS. */
export const DAY_TICKS = 40;
export const NIGHT_TICKS = 20;

export const enum Season {
  Spring = 0,
  Summer = 1,
  Autumn = 2,
  Winter = 3,
}

export function seasonOf(tick: number): Season {
  return (Math.floor(tick / TICKS_PER_SEASON) % SEASONS_PER_YEAR) as Season;
}

/** Position within the year in [0, 1). 0 = start of spring. */
export function yearPhase(tick: number): number {
  return (tick % TICKS_PER_YEAR) / TICKS_PER_YEAR;
}

/**
 * Smooth seasonal wave in [-1, 1]: peaks (+1) mid-summer, bottoms (-1) mid-winter.
 */
export function seasonalWave(tick: number): number {
  // Mid-summer is at phase 0.375 (middle of the second season).
  return Math.cos(2 * Math.PI * (yearPhase(tick) - 0.375));
}

export function isNight(tick: number): boolean {
  return tick % DAY_TICKS >= DAY_TICKS - NIGHT_TICKS;
}

/** 0 at full day, 1 at deep night, with short dusk/dawn ramps. */
export function darkness(tick: number): number {
  const t = tick % DAY_TICKS;
  const nightStart = DAY_TICKS - NIGHT_TICKS;
  const ramp = 3;
  if (t < nightStart - ramp) return 0;
  if (t < nightStart) return (t - (nightStart - ramp)) / ramp;
  if (t >= DAY_TICKS - ramp) return (DAY_TICKS - t) / ramp;
  return 1;
}
