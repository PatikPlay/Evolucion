import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { T, TRAIT_COUNT } from '../genetics/traits';
import { Act, Death, Flag } from '../behavior/actions';
import { Biome } from '../world/terrain';

/**
 * Per-tick bookkeeping of one organism: energy, water, temperature, fatigue,
 * disease, ageing and death.
 */
export function updatePhysiology(sim: ParcelSim, i: number): void {
  const o = sim.org;
  const cfg = sim.cfg;
  const oc = cfg.organisms;
  const Q = i * DERIVED_COUNT;
  const P = i * TRAIT_COUNT;
  const der = o.derived;
  const t = sim.world.terrain;
  const flags = o.flags[i] as number;
  const act = o.action[i] as number;
  const m075 = der[Q + D.M075] as number;
  const c = t.index(o.x[i] as number, o.y[i] as number);
  const resting = act === Act.Rest || act === Act.Sleep || act === Act.Hide;
  const hibernating = (flags & Flag.Hibernating) !== 0;

  // --- Energy ---
  let metab =
    oc.basalCoeff * m075 * (der[Q + D.MetabolicRate] as number) * (der[Q + D.UpkeepMult] as number);
  if (flags & Flag.Pregnant) metab *= 1.25;
  if (hibernating) metab *= 0.18;
  else if (resting) metab *= 0.85;
  metab *= 1 + (o.habitStress[i] as number);
  const speed = o.speed[i] as number;
  const vmax = der[Q + D.MaxSpeed] as number;
  const r = speed / vmax;
  const move = oc.moveCoeff * m075 * speed * (1 + 2 * r * r);

  // --- Temperature ---
  let temp = (t.baseTemp[c] as number) + sim.world.climate.offsetNow;
  if (flags & Flag.Burrowed) temp += (12 - temp) * 0.7 * (t.burrow[c] as number);
  else if (t.refuge[c]) temp += (12 - temp) * 0.5;
  else if (t.biome[c] === Biome.Forest) temp += (14 - temp) * 0.25;
  const low =
    (der[Q + D.ComfortLow] as number) -
    (hibernating ? 10 : 0) -
    ((o.huddle[i] as number) >= 2 ? 3 : 0);
  const high = der[Q + D.ComfortHigh] as number;
  let thermalCost = 0;
  let thermal = 0;
  if (temp < low) {
    const deficit = low - temp;
    thermalCost = metab * cfg.thermal.coldCost * deficit;
    thermal = -deficit / 10;
    if (deficit > cfg.thermal.damageMargin) {
      o.health[i] =
        (o.health[i] as number) -
        cfg.thermal.damagePerDegree * (deficit - cfg.thermal.damageMargin);
      o.dmgCause[i] = Death.Cold;
    }
  } else if (temp > high) {
    const excess = temp - high;
    thermal = excess / 10;
    o.hydration[i] = (o.hydration[i] as number) - cfg.thermal.heatThirst * excess;
    if (excess > cfg.thermal.damageMargin) {
      o.health[i] =
        (o.health[i] as number) - cfg.thermal.damagePerDegree * (excess - cfg.thermal.damageMargin);
      o.dmgCause[i] = Death.Heat;
    }
  }
  o.thermal[i] = thermal;

  // --- Disease ---
  let diseaseCost = 0;
  const inf = o.infection[i] as number;
  if (inf) {
    const strain = sim.strains.get(inf - 1);
    if (strain) {
      const res = o.pheno[P + strain.resistance] as number;
      const harm = strain.virulence * (1 - res) * (1 - 0.5 * res);
      o.health[i] = (o.health[i] as number) - harm;
      o.dmgCause[i] = Death.Disease;
      diseaseCost = metab * 0.3;
    }
    const timer = (o.infectionTimer[i] as number) - 1;
    o.infectionTimer[i] = timer;
    if (timer <= 0) {
      o.infection[i] = 0;
      o.immune[i] = (o.immune[i] as number) | (1 << (inf - 1));
      o.flags[i] = (o.flags[i] as number) & ~Flag.Infected;
    }
  }

  // Supplemental feeding (game action) offsets part of the basal cost.
  const ls = sim.lineages.get(o.lineage[i] as number);
  let bonus = 0;
  if (ls) {
    if (ls.feeding > 0) bonus += metab * ls.feeding;
    // Directed selection: the naturalist favours individuals with the chosen trait.
    if (ls.selectDir !== 0 && ls.selectTrait >= 0) {
      const v = o.pheno[P + ls.selectTrait] as number;
      bonus += metab * 0.45 * Math.max(-1, Math.min(1, (v - 0.5) * 4 * ls.selectDir));
    }
  }
  let energy = (o.energy[i] as number) - metab - move - thermalCost - diseaseCost + bonus;
  if (energy <= 0) {
    energy = 0;
    o.health[i] = (o.health[i] as number) - 0.012;
    o.dmgCause[i] = Death.Starvation;
  }
  const maxE = der[Q + D.MaxEnergy] as number;
  o.energy[i] = energy > maxE ? maxE : energy;

  // --- Water ---
  const heat = Math.max(0, temp - 22) / 10;
  const we = o.pheno[P + T.WaterEfficiency] as number;
  const thirstMult =
    (1 - we * (0.15 + 0.45 * Math.min(1, heat))) *
    (1 + 0.6 * heat) *
    (sim.world.climate.moistureNow < 0.7 ? 1.3 : 1);
  let hyd =
    (o.hydration[i] as number) - oc.thirstRate * thirstMult * (hibernating ? 0.2 : 1) * (1 + r);
  if (hyd <= 0) {
    hyd = 0;
    o.health[i] = (o.health[i] as number) - 0.01;
    o.dmgCause[i] = Death.Thirst;
  }
  o.hydration[i] = hyd;

  // --- Fatigue ---
  if (r > 0.6)
    o.fatigue[i] = Math.min(
      1,
      (o.fatigue[i] as number) + (oc.fatigueRunGain * r) / (der[Q + D.Endurance] as number),
    );
  else o.fatigue[i] = Math.max(0, (o.fatigue[i] as number) - oc.fatigueRecover * (resting ? 2 : 1));

  // --- Healing and ageing ---
  const viability = der[Q + D.Viability] as number;
  let health = o.health[i] as number;
  if (energy > maxE * 0.25 && hyd > 0.25 && !inf) health += oc.healRate * viability;
  const age = sim.tick - (o.birthTick[i] as number);
  const life = der[Q + D.Lifespan] as number;
  const ageFrac = age / life;
  if (ageFrac > cfg.aging.senescenceStart) {
    const s = (ageFrac - cfg.aging.senescenceStart) / (1 - cfg.aging.senescenceStart);
    health -= 0.0012 * s * s;
    if (s > 0.5) o.dmgCause[i] = Death.OldAge;
  }
  if (health > viability) health = viability;
  o.health[i] = health;
  if (health < 0.45) o.flags[i] = (o.flags[i] as number) | Flag.Limping;
  else o.flags[i] = (o.flags[i] as number) & ~Flag.Limping;
  if (health <= 0) {
    sim.kill(i, o.dmgCause[i] as Death);
    return;
  }
  if (ageFrac > 1.4) {
    sim.kill(i, Death.OldAge);
    return;
  }
}
