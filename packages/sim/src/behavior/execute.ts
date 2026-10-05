import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { Cap } from '../organisms/capabilities';
import { T, TRAIT_COUNT } from '../genetics/traits';
import { Act, Death, Flag, Food } from './actions';
import { Barrier, Biome, BIOME_MOVE } from '../world/terrain';
import { eatPlantAt, faunaRate, plantRateAt } from '../ecology/feeding';
import { attack, eatCarcass, fight } from '../ecology/predation';
import { mate } from '../ecology/reproduction';
import { coverAt, detectability } from './think';

const TURNS = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1];

/** Can organism `i` stand in cell `c` (coming from cell `from`)? */
export function passable(sim: ParcelSim, i: number, c: number, from: number): boolean {
  const t = sim.world.terrain;
  const caps = sim.org.capabilities[i] as number;
  const b = t.biome[c] as number;
  if (b === Biome.DeepWater && !(caps & Cap.Swim) && t.biome[from] !== Biome.DeepWater)
    return false;
  const bar = t.barrier[c] as number;
  if (bar && bar !== t.barrier[from]) {
    if (bar === Barrier.Hedge && !(caps & (Cap.Glide | Cap.Climb))) return false;
    if (bar === Barrier.Trench && !(caps & (Cap.Glide | Cap.Dig | Cap.Swim))) return false;
  }
  if (t.enclosure[c] !== t.enclosure[from]) return false;
  return true;
}

/** Effective top speed of `i` right now. */
export function currentMaxSpeed(sim: ParcelSim, i: number): number {
  const o = sim.org;
  const q = i * DERIVED_COUNT;
  const growth = Math.min(
    1,
    (o.mass[i] as number) / (o.derived[q + D.AdultMassPotential] as number),
  );
  return (
    (o.derived[q + D.MaxSpeed] as number) *
    (0.55 + 0.45 * growth) *
    (0.85 + 0.15 * Math.max(0, o.health[i] as number))
  );
}

/**
 * Moves `i` towards (tx, ty) at `frac` of its top speed, steering around
 * impassable cells. Returns the remaining distance.
 */
export function moveTo(sim: ParcelSim, i: number, tx: number, ty: number, frac: number): number {
  const o = sim.org;
  const t = sim.world.terrain;
  const x = o.x[i] as number;
  const y = o.y[i] as number;
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.05) {
    o.speed[i] = 0;
    return dist;
  }
  const from = t.index(x, y);
  const caps = o.capabilities[i] as number;
  const b = t.biome[from] as number;
  let terrainF = BIOME_MOVE[b] as number;
  const water = b === Biome.ShallowWater || b === Biome.DeepWater;
  if (water && caps & Cap.Swim) terrainF = 1.15;
  else if (caps & Cap.Climb && (b === Biome.Forest || b === Biome.Rock)) terrainF = 1.05;
  let f = frac;
  if ((o.fatigue[i] as number) > 0.9) f = Math.min(f, sim.cfg.organisms.walkFraction);
  const v = currentMaxSpeed(sim, i) * f * terrainF;
  const step = Math.min(v, dist);
  const base = Math.atan2(dy, dx);
  for (let k = 0; k < TURNS.length; k++) {
    const a = base + (TURNS[k] as number);
    let nx = x + Math.cos(a) * step;
    let ny = y + Math.sin(a) * step;
    if (nx < 0) nx = 0;
    else if (nx >= sim.width) nx = sim.width - 0.001;
    if (ny < 0) ny = 0;
    else if (ny >= sim.height) ny = sim.height - 0.001;
    const c = t.index(nx, ny);
    if (c !== from && !passable(sim, i, c, from)) continue;
    o.x[i] = nx;
    o.y[i] = ny;
    o.heading[i] = a;
    o.speed[i] = step;
    const nb = t.biome[c] as number;
    let flags =
      (o.flags[i] as number) &
      ~(Flag.Swimming | Flag.Climbing | Flag.Gliding | Flag.Hidden | Flag.Burrowed);
    if (nb === Biome.ShallowWater || nb === Biome.DeepWater) flags |= Flag.Swimming;
    if (caps & Cap.Glide && f > 0.8 && (b === Biome.Forest || b === Biome.Rock))
      flags |= Flag.Gliding;
    o.flags[i] = flags;
    return dist - step;
  }
  // Boxed in: rethink soon.
  o.speed[i] = 0;
  o.nextThink[i] = Math.min(o.nextThink[i] as number, sim.tick + 1);
  return dist;
}

function stop(sim: ParcelSim, i: number): void {
  sim.org.speed[i] = 0;
}

function rethink(sim: ParcelSim, i: number): void {
  sim.org.nextThink[i] = sim.tick + 1;
}

/** Performs one tick of the organism's current behaviour. */
export function execute(sim: ParcelSim, i: number): void {
  const o = sim.org;
  const cfg = sim.cfg;
  const walk = cfg.organisms.walkFraction;
  const act = o.action[i] as Act;
  const t = sim.world.terrain;
  switch (act) {
    case Act.Rest:
    case Act.Sleep: {
      stop(sim, i);
      settle(sim, i);
      break;
    }
    case Act.Graze: {
      // Grazers nibble on the way if there is anything worth eating.
      const here = t.index(o.x[i] as number, o.y[i] as number);
      const rem0 = Math.hypot(
        (o.tx[i] as number) - (o.x[i] as number),
        (o.ty[i] as number) - (o.y[i] as number),
      );
      if (
        rem0 >= 0.6 &&
        plantRateAt(sim, i, here) > cfg.organisms.basalCoeff * sim.der(i, D.M075)
      ) {
        gainEnergy(sim, i, eatPlantAt(sim, i, here));
        moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk * 0.4);
        break;
      }
      const rem = moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk);
      if (rem < 0.6) {
        const gain = eatPlantAt(sim, i, t.index(o.x[i] as number, o.y[i] as number));
        gainEnergy(sim, i, gain);
        if (gain < cfg.organisms.basalCoeff * sim.der(i, D.M075) * 0.8) rethink(sim, i);
        if ((o.energy[i] as number) >= sim.der(i, D.MaxEnergy) * 0.98) rethink(sim, i);
      }
      break;
    }
    case Act.Drink: {
      const c = t.index(o.x[i] as number, o.y[i] as number);
      if (sim.world.access.drinkable[c]) {
        stop(sim, i);
        o.hydration[i] = Math.min(1, (o.hydration[i] as number) + cfg.organisms.drinkRate);
        if ((o.hydration[i] as number) >= 0.98) rethink(sim, i);
      } else {
        moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk * 1.3);
      }
      break;
    }
    case Act.Flee: {
      const j = o.target[i] as number;
      if (j >= 0 && o.alive[j] && o.id[j] === o.targetId[i]) {
        const dx = (o.x[i] as number) - (o.x[j] as number);
        const dy = (o.y[i] as number) - (o.y[j] as number);
        const d = Math.hypot(dx, dy) || 1;
        if (d > sim.der(i, D.Perception) * 1.3) {
          rethink(sim, i);
          break;
        }
        // Keep running away unless already heading to nearby shelter.
        const sx = (o.tx[i] as number) - (o.x[i] as number);
        const sy = (o.ty[i] as number) - (o.y[i] as number);
        if (sx * dx + sy * dy < 0 || Math.hypot(sx, sy) < 0.5) {
          o.tx[i] = Math.min(sim.width - 0.01, Math.max(0, (o.x[i] as number) + (dx / d) * 6));
          o.ty[i] = Math.min(sim.height - 0.01, Math.max(0, (o.y[i] as number) + (dy / d) * 6));
        }
      }
      const rem = moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, 1);
      if (rem < 0.3) {
        settle(sim, i);
        rethink(sim, i);
      }
      break;
    }
    case Act.Hunt: {
      const j = sim.org.resolve(o.target[i] as number, o.targetId[i] as number);
      if (j < 0) {
        rethink(sim, i);
        break;
      }
      const d = Math.hypot(
        (o.x[j] as number) - (o.x[i] as number),
        (o.y[j] as number) - (o.y[i] as number),
      );
      if (
        d > sim.der(i, D.Perception) * cfg.predation.giveUpDistanceFactor ||
        (o.fatigue[i] as number) > 0.97
      ) {
        rethink(sim, i);
        break;
      }
      // Stalk slowly (hard to notice) while far; sprint from close range.
      // Hunters clearly faster than their prey run it down from farther away.
      const advantage = currentMaxSpeed(sim, i) - currentMaxSpeed(sim, j);
      const sprinting =
        d <= cfg.predation.sprintDistance + Math.max(0, advantage) * cfg.predation.coursing;
      moveTo(
        sim,
        i,
        o.x[j] as number,
        o.y[j] as number,
        sprinting ? 1 : cfg.predation.stalkFraction,
      );
      // A charging hunter is hard to miss: the prey bolts at once if it notices.
      if (
        sprinting &&
        o.action[j] !== Act.Flee &&
        sim.isAdult(j) &&
        d < sim.der(j, D.Perception) * detectability(sim, i)
      ) {
        o.nextThink[j] = sim.tick;
      }
      const reach =
        cfg.predation.reach * (1 + 0.15 * Math.log2(Math.max(0.25, (o.mass[i] as number) / 4)));
      const d2 = Math.hypot(
        (o.x[j] as number) - (o.x[i] as number),
        (o.y[j] as number) - (o.y[i] as number),
      );
      if (d2 < reach) attack(sim, i, j);
      break;
    }
    case Act.Forage: {
      // Wander slowly through the block while catching small fauna.
      const rem = moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk * 0.6);
      if (rem < 0.3) {
        o.tx[i] = Math.min(
          sim.width - 0.01,
          Math.max(0, (o.x[i] as number) + sim.rngBehavior.range(-2, 2)),
        );
        o.ty[i] = Math.min(
          sim.height - 0.01,
          Math.max(0, (o.y[i] as number) + sim.rngBehavior.range(-2, 2)),
        );
      }
      const gain = faunaRate(sim, i, o.x[i] as number, o.y[i] as number, true);
      gainEnergy(sim, i, gain);
      if ((o.energy[i] as number) >= sim.der(i, D.MaxEnergy) * 0.98) rethink(sim, i);
      break;
    }
    case Act.Scavenge: {
      const rem = moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk * 1.4);
      if (rem < 0.8) {
        const c = sim.world.carcasses.nearest(o.x[i] as number, o.y[i] as number, 1.2);
        if (c < 0) {
          rethink(sim, i);
          break;
        }
        stop(sim, i);
        eatCarcass(sim, i, c);
        if ((o.energy[i] as number) >= sim.der(i, D.MaxEnergy) * 0.98) rethink(sim, i);
      }
      break;
    }
    case Act.Court: {
      const j = sim.org.resolve(o.target[i] as number, o.targetId[i] as number);
      if (j < 0) {
        rethink(sim, i);
        break;
      }
      const rem = moveTo(sim, i, o.x[j] as number, o.y[j] as number, walk * 1.2);
      if (rem < cfg.reproduction.mateRange) {
        mate(sim, i, j);
        rethink(sim, i);
      }
      break;
    }
    case Act.Defend: {
      const j = sim.org.resolve(o.target[i] as number, o.targetId[i] as number);
      if (j < 0) {
        rethink(sim, i);
        break;
      }
      const rem = moveTo(sim, i, o.x[j] as number, o.y[j] as number, 0.85);
      if (rem < cfg.predation.reach) {
        fight(sim, i, j);
        rethink(sim, i);
      }
      break;
    }
    case Act.CareYoung: {
      const j = sim.org.resolve(o.target[i] as number, o.targetId[i] as number);
      if (j < 0) {
        rethink(sim, i);
        break;
      }
      const rem = moveTo(sim, i, o.x[j] as number, o.y[j] as number, walk);
      if (rem < 1.2) {
        stop(sim, i);
        const give = cfg.organisms.biteCoeff * 0.6 * sim.der(i, D.M075);
        const maxE = sim.der(i, D.MaxEnergy);
        if ((o.energy[i] as number) > maxE * 0.4) {
          o.energy[i] = (o.energy[i] as number) - give;
          gainEnergy(sim, j, give * 0.8);
        } else rethink(sim, i);
        if ((o.energy[j] as number) > sim.der(j, D.MaxEnergy) * 0.9) rethink(sim, i);
      }
      break;
    }
    case Act.Hide:
    case Act.Hibernate: {
      const rem = moveTo(
        sim,
        i,
        o.tx[i] as number,
        o.ty[i] as number,
        act === Act.Hide ? 0.9 : walk,
      );
      if (rem < 0.5) {
        stop(sim, i);
        settle(sim, i);
        if (act === Act.Hibernate) o.flags[i] = (o.flags[i] as number) | Flag.Hibernating;
      }
      break;
    }
    case Act.Dig: {
      const rem = moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk);
      if (rem < 0.6) {
        stop(sim, i);
        const c = t.index(o.x[i] as number, o.y[i] as number);
        t.burrow[c] = Math.min(
          1,
          (t.burrow[c] as number) +
            0.006 * (0.5 + (o.pheno[i * TRAIT_COUNT + T.LegStrength] as number)),
        );
        o.energy[i] = (o.energy[i] as number) - cfg.organisms.basalCoeff * sim.der(i, D.M075) * 0.5;
        if ((t.burrow[c] as number) >= 1) rethink(sim, i);
        settle(sim, i);
      }
      break;
    }
    case Act.Store: {
      const rem = moveTo(sim, i, o.tx[i] as number, o.ty[i] as number, walk);
      if (rem < 0.6) {
        stop(sim, i);
        const atHome =
          Math.hypot(
            (o.x[i] as number) - (o.homeX[i] as number),
            (o.y[i] as number) - (o.homeY[i] as number),
          ) < 1;
        const maxE = sim.der(i, D.MaxEnergy);
        if (atHome && (o.cache[i] as number) > 0.5 && (o.energy[i] as number) < maxE * 0.8) {
          const take = Math.min(
            o.cache[i] as number,
            cfg.organisms.biteCoeff * sim.der(i, D.M075) * 0.5,
          );
          o.cache[i] = (o.cache[i] as number) - take;
          gainEnergy(sim, i, take);
          sim.stats.onEat(i, Food.Fruit, take);
        } else if (!atHome) {
          // Gather: half of what is bitten goes to the cache.
          const gain = eatPlantAt(sim, i, t.index(o.x[i] as number, o.y[i] as number));
          o.cache[i] = Math.min(sim.der(i, D.MaxEnergy) * 1.5, (o.cache[i] as number) + gain * 0.7);
          if (gain <= 0) rethink(sim, i);
        } else rethink(sim, i);
      }
      break;
    }
    case Act.FollowGroup:
    case Act.Explore:
    case Act.Migrate: {
      const rem = moveTo(
        sim,
        i,
        o.tx[i] as number,
        o.ty[i] as number,
        act === Act.Migrate ? walk * 1.4 : walk,
      );
      if (rem < 0.4) rethink(sim, i);
      break;
    }
    default:
      stop(sim, i);
  }
  // Drowning: non-swimmers stranded in deep water (floods).
  const c = t.index(o.x[i] as number, o.y[i] as number);
  if (t.biome[c] === Biome.DeepWater && !((o.capabilities[i] as number) & Cap.Swim)) {
    o.health[i] = (o.health[i] as number) - 0.02;
    o.dmgCause[i] = Death.Drowning;
    if (act !== Act.Flee) {
      const w = sim.world.access.nearestWater[c] as number;
      if (w >= 0) {
        o.action[i] = Act.Explore;
        o.tx[i] = (w % sim.width) + 0.5;
        o.ty[i] = Math.floor(w / sim.width) + 0.5;
      }
    }
  }
}

/** Resting animals use whatever shelter is at hand: burrows, trees, cover. */
function settle(sim: ParcelSim, i: number): void {
  const o = sim.org;
  const t = sim.world.terrain;
  const c = t.index(o.x[i] as number, o.y[i] as number);
  const caps = o.capabilities[i] as number;
  let flags = (o.flags[i] as number) & ~(Flag.Hidden | Flag.Burrowed | Flag.Climbing);
  if (caps & Cap.Dig && (t.burrow[c] as number) > 0.3) flags |= Flag.Burrowed;
  else if (caps & Cap.Climb && t.biome[c] === Biome.Forest) flags |= Flag.Climbing;
  else if (coverAt(sim, c) > 0.35) flags |= Flag.Hidden;
  o.flags[i] = flags;
}

export function gainEnergy(sim: ParcelSim, i: number, amount: number): void {
  const o = sim.org;
  const maxE = o.derived[i * DERIVED_COUNT + D.MaxEnergy] as number;
  const e = (o.energy[i] as number) + amount;
  o.energy[i] = e > maxE ? maxE : e;
}
