import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { Cap } from '../organisms/capabilities';
import { refreshMass } from '../organisms/derived';
import { T, TRAIT_COUNT } from '../genetics/traits';
import { Act, ACT_COUNT, Death, Flag } from './actions';
import { CUSTOMS, Custom } from './customs';
import { Season, seasonOf } from '../time';
import { hueDistance } from '../math';
import { faunaRate, plantRateAt } from '../ecology/feeding';
import { tryInfect } from '../ecology/health';
import { BIOME_COVER } from '../world/terrain';

const NEIGH = new Int32Array(192);

/** Diminishing returns of a food source relative to the organism's needs. */
function sat(rate: number, need: number): number {
  return rate / (rate + need);
}
const U = new Float64Array(ACT_COUNT);

/** Visual hue of the ground per biome, for camouflage (matches the client's palette). */
const BIOME_HUE = [0.28, 0.33, 0.22, 0.12, 0.08, 0.5, 0.55];

/** Attack power of organism `i` (strength, size, condition). */
export function power(sim: ParcelSim, i: number): number {
  const q = i * DERIVED_COUNT;
  const d = sim.org.derived;
  return (d[q + D.Strength] as number) * (d[q + D.M075] as number) * (0.6 + 0.4 * (sim.org.health[i] as number));
}

/** Resistance of organism `i` to an attack (size, armour, spines, condition). */
export function resistance(sim: ParcelSim, i: number): number {
  const p = i * TRAIT_COUNT;
  const ph = sim.org.pheno;
  return (
    (0.6 + 0.6 * (ph[p + T.LegStrength] as number)) *
    (sim.org.derived[i * DERIVED_COUNT + D.M075] as number) *
    (1 + 1.6 * (ph[p + T.Armor] as number) + 0.6 * (ph[p + T.Spines] as number)) *
    (0.6 + 0.4 * (sim.org.health[i] as number))
  );
}

/** How easily organism `j` is noticed (0.1–1.6), relative to its body visibility. */
export function detectability(sim: ParcelSim, j: number): number {
  const o = sim.org;
  let v = o.derived[j * DERIVED_COUNT + D.Visibility] as number;
  const f = o.flags[j] as number;
  const c = sim.world.terrain.index(o.x[j] as number, o.y[j] as number);
  if (f & Flag.Burrowed) v *= 0.1;
  else if (f & Flag.Hidden) v *= 1 - 0.75 * Math.min(1, coverAt(sim, c));
  if (f & Flag.Climbing) v *= 0.6;
  const p = j * TRAIT_COUNT;
  const consp = o.pheno[p + T.Conspicuous] as number;
  // Colour matching the ground hides cryptic animals, especially when still.
  const match = 1 - Math.min(1, hueDistance(visualHue(o.pheno[p + T.Hue] as number), BIOME_HUE[sim.world.terrain.biome[c] as number] as number) * 5);
  const still = (o.speed[j] as number) < 0.03 ? 1 : 0.4;
  v *= 1 - 0.55 * (1 - consp) * match * still;
  if ((o.capabilities[j] as number) & Cap.Camouflage && still === 1) v *= 0.6;
  if ((o.speed[j] as number) > 0.15) v *= 1.25;
  return v < 0.08 ? 0.08 : v;
}

/** Hue drawn by the client for a hue trait value (brown → ochre → green → teal). */
export function visualHue(trait: number): number {
  return 0.02 + 0.6 * trait;
}

export function coverAt(sim: ParcelSim, c: number): number {
  const t = sim.world.terrain;
  const veg = sim.world.vegetation;
  const plants = ((veg.biomass[1] as Float32Array)[c] as number) / 12 + ((veg.biomass[2] as Float32Array)[c] as number) / 30;
  return (BIOME_COVER[t.biome[c] as number] as number) * (0.5 + 0.5 * Math.min(1, plants)) + (t.refuge[c] ? 0.5 : 0);
}

/** How dangerous organism `j` is to organism `i` (0 = harmless). */
export function danger(sim: ParcelSim, j: number, i: number, resistI: number): number {
  const o = sim.org;
  if (o.species[j] === o.species[i]) return 0;
  const carn = o.pheno[j * TRAIT_COUNT + T.Carnivory] as number;
  if (carn < 0.45 || !sim.isAdult(j) || (o.flags[j] as number) & Flag.Hibernating) return 0;
  const pw = power(sim, j);
  const ratio = pw / (pw + resistI);
  if (ratio < 0.2) return 0;
  return carn * ratio;
}

function preyValue(sim: ParcelSim, i: number, j: number, myPower: number, d: number): number {
  const o = sim.org;
  if (o.species[j] === o.species[i]) return 0;
  if ((o.flags[j] as number) & Flag.Burrowed && !((o.capabilities[i] as number) & Cap.Dig)) return 0;
  if ((o.flags[j] as number) & Flag.Climbing && !((o.capabilities[i] as number) & Cap.Climb)) return 0;
  const rj = resistance(sim, j);
  let pSucc = myPower / (myPower + rj);
  if ((o.capabilities[i] as number) & Cap.PackHunt) pSucc = Math.min(0.95, pSucc * 1.5);
  if (pSucc < 0.22) return 0;
  const pj = j * TRAIT_COUNT;
  let v = Math.sqrt(o.mass[j] as number) * pSucc;
  // Learned aversion to prey that looks like something toxic eaten before.
  const av = o.aversion[i] as number;
  if (av > 0.01) {
    const similar = 1 - Math.min(1, hueDistance(o.pheno[pj + T.Hue] as number, o.aversionHue[i] as number) * 6);
    v *= 1 - Math.min(1, av * similar * (0.4 + 0.6 * (o.pheno[pj + T.Conspicuous] as number)) * 1.5);
  }
  // Prey faster than us is a poor bet.
  if (sim.der(j, D.MaxSpeed) > sim.der(i, D.MaxSpeed) * 1.1) v *= 0.5;
  return v / (1 + d * 0.12);
}

/** Juvenile growth: mass approaches the adult size, which depends on nutrition. */
function growJuvenile(sim: ParcelSim, i: number, age: number, maturity: number): void {
  const o = sim.org;
  const q = i * DERIVED_COUNT;
  const maxE = o.derived[q + D.MaxEnergy] as number;
  const frac = (o.energy[i] as number) / maxE;
  o.nutrition[i] = (o.nutrition[i] as number) + (Math.min(1, frac / 0.7) - (o.nutrition[i] as number)) * 0.08;
  const pot = o.derived[q + D.AdultMassPotential] as number;
  const target = pot * (0.7 + 0.3 * (o.nutrition[i] as number));
  const birth = o.birthMass[i] as number;
  const progress = Math.min(1, age / maturity);
  const m = birth + (target - birth) * Math.pow(progress, 0.9);
  const dm = m - (o.mass[i] as number);
  if (dm > 0) {
    // Building tissue costs energy; starving juveniles grow less.
    const cost = dm * 0.35;
    if ((o.energy[i] as number) > cost * 2) {
      o.energy[i] = (o.energy[i] as number) - cost;
      o.mass[i] = m;
      refreshMass(o, i, sim.cfg);
    }
  }
}

/**
 * Utility AI: perceives, scores every behaviour and commits to the best one
 * until the next evaluation (or until something urgent interrupts).
 */
export function think(sim: ParcelSim, i: number): void {
  const o = sim.org;
  const cfg = sim.cfg;
  const tick = sim.tick;
  const P = i * TRAIT_COUNT;
  const Q = i * DERIVED_COUNT;
  const ph = o.pheno;
  const der = o.derived;
  const rng = sim.rngBehavior;
  o.nextThink[i] = tick + cfg.organisms.thinkInterval;
  const x = o.x[i] as number;
  const y = o.y[i] as number;
  const age = tick - (o.birthTick[i] as number);
  const maturity = der[Q + D.Maturity] as number;
  const adult = age >= maturity;
  if (!adult) growJuvenile(sim, i, age, maturity);

  // Natal dispersal: young adults settle away from where they were born,
  // which spreads the population over the parcel.
  if (adult && !((o.flags[i] as number) & Flag.Dispersed)) {
    o.flags[i] = (o.flags[i] as number) | Flag.Dispersed;
    if (o.generation[i] !== 0 && cfg.organisms.natalDispersal > 0) {
      // Habitat selection: scout a few places and settle in the best one
      // (food, water, few conspecifics), so the range expands into empty land.
      const reach = 6 + 18 * (ph[P + T.Curiosity] as number);
      let hx = x;
      let hy = y;
      let bestS = -Infinity;
      const terrain = sim.world.terrain;
      for (let k = 0; k < 6; k++) {
        const a = rng.float() * Math.PI * 2;
        const rr = 3 + rng.float() * reach;
        const cx = Math.min(sim.width - 1, Math.max(1, x + Math.cos(a) * rr));
        const cy = Math.min(sim.height - 1, Math.max(1, y + Math.sin(a) * rr));
        const c = terrain.index(cx, cy);
        const food = plantRateAt(sim, i, c);
        const waterD = sim.world.access.waterDistance[c] as number;
        const crowd = sim.grid.bucketCount(cx, cy);
        const sc = food / (1 + 0.02 * waterD) / (1 + 0.15 * crowd) - 0.0005 * rr;
        if (sc > bestS) {
          bestS = sc;
          hx = cx;
          hy = cy;
        }
      }
      const r = Math.hypot(hx - x, hy - y);
      o.homeX[i] = hx;
      o.homeY[i] = hy;
      o.memFoodX[i] = hx;
      o.memFoodY[i] = hy;
      o.memFoodQ[i] = 0;
      o.action[i] = Act.Migrate;
      o.tx[i] = hx;
      o.ty[i] = hy;
      o.nextThink[i] = tick + Math.ceil(r / 0.1);
      return;
    }
  }

  const maxE = der[Q + D.MaxEnergy] as number;
  const energyFrac = (o.energy[i] as number) / maxE;
  const hunger = energyFrac >= 1 ? 0 : 1 - energyFrac;
  const thirst = 1 - (o.hydration[i] as number);
  const fatigue = o.fatigue[i] as number;
  const climate = sim.world.climate;
  const dark = climate.darknessNow;
  const noct = ph[P + T.Nocturnality] as number;
  const perception = (der[Q + D.Perception] as number) * (1 - dark) + (der[Q + D.NightPerception] as number) * dark;
  const activity = dark * noct + (1 - dark) * (1 - noct);
  const season = seasonOf(tick);
  const caps = o.capabilities[i] as number;
  const flags = o.flags[i] as number;
  const cell = sim.world.terrain.index(x, y);

  // Hibernating animals stay put until spring or until reserves run low.
  if (flags & Flag.Hibernating) {
    if (season === Season.Winter && energyFrac > 0.12) {
      o.action[i] = Act.Hibernate;
      o.nextThink[i] = tick + cfg.organisms.thinkInterval * 4;
      return;
    }
    o.flags[i] = flags & ~Flag.Hibernating;
  }

  const fear = ph[P + T.Fear] as number;
  const aggression = ph[P + T.Aggression] as number;
  const sociability = ph[P + T.Sociability] as number;
  const carn = ph[P + T.Carnivory] as number;
  const species = o.species[i] as number;
  const sex = o.sex[i] as number;
  const myPower = power(sim, i);
  const myResist = resistance(sim, i);
  const infected = o.infection[i] as number;
  const contact2 = cfg.disease.contactRange * cfg.disease.contactRange;
  const female = sex === 0;
  const receptive =
    adult &&
    tick >= (o.cooldownUntil[i] as number) &&
    !(flags & Flag.Pregnant) &&
    energyFrac > (female ? cfg.reproduction.breedEnergy : cfg.reproduction.maleBreedEnergy);

  let threatJ = -1;
  let threatScore = 0;
  let preyJ = -1;
  let preyScore = 0;
  let mateJ = -1;
  let mateScore = 0;
  let rivalJ = -1;
  let rivalDist = Infinity;
  let youngJ = -1;
  let youngNeed = 0;
  let motherNear = -1;
  let gx = 0;
  let gy = 0;
  let gn = 0;
  let close = 0;
  let crowd = 0;
  const homeX = o.homeX[i] as number;
  const homeY = o.homeY[i] as number;
  const territorial = (ph[P + T.Territoriality] as number) > 0.45;
  const myId = o.id[i] as number;
  const prefC = ph[P + T.PrefConspicuous] as number;
  const prefS = ph[P + T.PrefSize] as number;
  const myMass = o.mass[i] as number;

  const n = sim.grid.query(x, y, perception, o.x, o.y, NEIGH, i);
  for (let k = 0; k < n; k++) {
    const j = NEIGH[k] as number;
    const dx = (o.x[j] as number) - x;
    const dy = (o.y[j] as number) - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 4) crowd++;
    if (infected && d2 < contact2) tryInfect(sim, i, j);
    if (o.species[j] === species) {
      gx += o.x[j] as number;
      gy += o.y[j] as number;
      gn++;
      if (d2 < 2.25) close++;
      const jAdult = sim.isAdult(j);
      if (!jAdult) {
        if (o.motherId[j] === myId) {
          const need = 1 - (o.energy[j] as number) / (o.derived[j * DERIVED_COUNT + D.MaxEnergy] as number);
          if (need > youngNeed) {
            youngNeed = need;
            youngJ = j;
          }
        }
        continue;
      }
      if (o.id[j] === o.motherId[i]) motherNear = j;
      if (o.sex[j] !== sex) {
        if (receptive && tick >= (o.cooldownUntil[j] as number) && !((o.flags[j] as number) & Flag.Pregnant)) {
          const pj = j * TRAIT_COUNT;
          // Females choose by visible traits; males simply approach the nearest receptive female.
          const s = female
            ? (0.3 + prefC * (o.pheno[pj + T.Conspicuous] as number) * 1.5 + prefS * Math.min(2, (o.mass[j] as number) / myMass)) / (1 + Math.sqrt(d2) * 0.1)
            : 1 / (1 + Math.sqrt(d2));
          if (s > mateScore) {
            mateScore = s;
            mateJ = j;
          }
        }
      } else if (territorial && adult && d2 < 16) {
        const hx = (o.x[j] as number) - homeX;
        const hy = (o.y[j] as number) - homeY;
        if (hx * hx + hy * hy < 25 && d2 < rivalDist) {
          rivalDist = d2;
          rivalJ = j;
        }
      }
      continue;
    }
    // Other species: only what we actually notice counts.
    const d = Math.sqrt(d2);
    if (d > perception * detectability(sim, j)) continue;
    const dang = danger(sim, j, i, myResist);
    if (dang > 0) {
      const s = dang * (1 - d / (perception + 1));
      if (s > threatScore) {
        threatScore = s;
        threatJ = j;
      }
    }
    if (carn > 0.35 && adult) {
      const v = preyValue(sim, i, j, myPower, d);
      if (v > preyScore) {
        preyScore = v;
        preyJ = j;
      }
    }
    // Other lineages competing for the same food are rivals too (after the Great Exchange).
    if (territorial && adult && o.lineage[j] !== o.lineage[i] && d2 < 16 && Math.abs((o.pheno[j * TRAIT_COUNT + T.Carnivory] as number) - carn) < 0.3 && d2 < rivalDist) {
      rivalDist = d2;
      rivalJ = j;
    }
  }
  o.huddle[i] = close;
  // Calls and scent marks: receptive animals locate mates far beyond sight.
  if (receptive && mateJ < 0) {
    const callRange = perception + 6 + 10 * (((ph[P + T.Smell] as number) + (ph[P + T.Hearing] as number)) * 0.5);
    const m = sim.grid.query(x, y, callRange, o.x, o.y, NEIGH, i);
    let bestD = Infinity;
    for (let k = 0; k < m; k++) {
      const j = NEIGH[k] as number;
      if (o.species[j] !== species || o.sex[j] === sex || !sim.isAdult(j)) continue;
      if (tick < (o.cooldownUntil[j] as number) || (o.flags[j] as number) & Flag.Pregnant) continue;
      const d2 = ((o.x[j] as number) - x) ** 2 + ((o.y[j] as number) - y) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        mateJ = j;
      }
    }
    if (mateJ >= 0) mateScore = 0.5;
  }
  if (!infected && crowd >= 6 && rng.float() < cfg.disease.spontaneous * crowd * crowd) {
    o.infection[i] = 1;
    o.infectionTimer[i] = sim.strains.get(0)?.duration ?? 60;
  }

  // Ambient predators (raptors, snakes) take small, visible and careless animals.
  if (!(flags & (Flag.Burrowed | Flag.Hibernating))) {
    const ap = cfg.ambientPredation;
    const sizeF = 1 / (1 + Math.pow(myMass / ap.halfMass, 2));
    const alert = 1 - 0.35 * (ph[P + T.Hearing] as number) - 0.25 * fear - (gn >= 3 ? 0.15 : 0);
    const escape = 1 / (0.6 + (der[Q + D.MaxSpeed] as number) / 0.24 * 0.4);
    const guarded = !adult && motherNear >= 0 ? 0.5 : 1;
    const risk = ap.base * cfg.organisms.thinkInterval * sizeF * detectability(sim, i) * alert * escape * guarded * (flags & Flag.Climbing ? 0.5 : 1);
    if (rng.float() < risk) {
      sim.kill(i, Death.Predation);
      return;
    }
  }

  if (threatJ >= 0) {
    o.memThreatX[i] = o.x[threatJ] as number;
    o.memThreatY[i] = o.y[threatJ] as number;
    o.memThreatTick[i] = tick;
  }
  const sinceThreat = tick - (o.memThreatTick[i] as number);
  const recentThreat = sinceThreat < 80 ? 1 - sinceThreat / 80 : 0;

  // --- Food options ---
  const basalNeed = cfg.organisms.basalCoeff * (der[Q + D.M075] as number) * 2;
  let grazeRate = 0;
  let grazeCell = -1;
  if (hunger > 0.08 || season === Season.Autumn) {
    const t = sim.world.terrain;
    const radius = Math.min(perception, 7);
    let bestScore = 0;
    for (let s = 0; s < 10; s++) {
      let cx: number;
      let cy: number;
      if (s === 0) {
        cx = x;
        cy = y;
      } else if (s === 1) {
        cx = o.memFoodX[i] as number;
        cy = o.memFoodY[i] as number;
      } else {
        // Mostly nearby patches, plus a couple of long-range scouting guesses.
        const a = rng.float() * Math.PI * 2;
        const r = s < 8 ? (0.3 + 0.7 * rng.float()) * radius : radius + rng.float() * 14;
        cx = x + Math.cos(a) * r;
        cy = y + Math.sin(a) * r;
      }
      if (!t.inBounds(cx, cy)) continue;
      const c = t.index(cx, cy);
      const rate = plantRateAt(sim, i, c);
      const dist = Math.hypot(cx - x, cy - y);
      // Prefer pastures within reach of water, more so when thirsty.
      const waterD = sim.world.access.waterDistance[c] as number;
      const score = rate / (1 + 0.07 * dist) / (1 + 0.03 * waterD * (0.4 + thirst));
      if (score > bestScore) {
        bestScore = score;
        grazeRate = rate;
        grazeCell = c;
      }
    }
  }
  const forageRate = hunger > 0.08 ? faunaRate(sim, i, x, y, false) : 0;
  let carcass = -1;
  let scavengeRate = 0;
  if (hunger > 0.1 && carn > 0.3) {
    carcass = sim.world.carcasses.nearest(x, y, perception);
    if (carcass >= 0) {
      const bite = cfg.organisms.biteCoeff * (der[Q + D.M075] as number);
      const dist = Math.hypot((sim.world.carcasses.x[carcass] as number) - x, (sim.world.carcasses.y[carcass] as number) - y);
      scavengeRate = (Math.min(bite, sim.world.carcasses.meat[carcass] as number) * (der[Q + D.EffMeat] as number)) / (1 + 0.15 * dist);
    }
  }
  const huntRate = preyJ >= 0 ? preyScore * cfg.organisms.biteCoeff * (der[Q + D.M075] as number) * (der[Q + D.EffMeat] as number) * 2.5 : 0;
  const foodDrive = Math.pow(hunger, 1.2) * 1.5;

  U.fill(0);
  U[Act.Graze] = grazeCell >= 0 ? foodDrive * sat(grazeRate, basalNeed) : 0;
  U[Act.Forage] = foodDrive * sat(forageRate, basalNeed) * 0.9;
  U[Act.Scavenge] = carcass >= 0 ? foodDrive * sat(scavengeRate, basalNeed) : 0;
  U[Act.Hunt] = preyJ >= 0 ? foodDrive * sat(huntRate, basalNeed) * (0.6 + 0.8 * aggression) : 0;
  U[Act.Drink] = Math.pow(thirst, 1.4) * 1.7;
  if (threatJ >= 0) U[Act.Flee] = (0.45 + 0.9 * fear) * Math.min(1, threatScore * 2.5) + 0.1;
  U[Act.Hide] = fear * (0.3 * recentThreat + 0.5 * Math.min(1, threatScore * 2)) * (sim.world.access.shelterDistance[cell]! < 6 ? 1 : 0.4);
  if (mateJ >= 0) {
    const seasonF = season === Season.Spring ? 1.3 : season === Season.Summer ? 1 : season === Season.Autumn ? 0.55 : 0.2;
    const threshold = female ? cfg.reproduction.breedEnergy : cfg.reproduction.maleBreedEnergy;
    const surplus = Math.min(1, (energyFrac - threshold) / (1 - threshold));
    U[Act.Court] = (0.25 + 0.4 * seasonF) * Math.sqrt(Math.max(0, surplus));
  }
  if (gn > 0) {
    const cxg = gx / gn - x;
    const cyg = gy / gn - y;
    const dc = Math.sqrt(cxg * cxg + cyg * cyg);
    U[Act.FollowGroup] = sociability * 0.45 * Math.min(1, dc / 4);
  }
  if (!adult && motherNear >= 0) U[Act.FollowGroup] = Math.max(U[Act.FollowGroup] as number, 0.55 * (1 - age / maturity));
  if (rivalJ >= 0) U[Act.Defend] = (ph[P + T.Territoriality] as number) * (0.4 + aggression) * 0.55 * (1 - hunger * 0.5);
  if (youngJ >= 0 && energyFrac > 0.35) U[Act.CareYoung] = (ph[P + T.ParentalCare] as number) * youngNeed * 1.1;
  U[Act.Rest] = fatigue * 0.7 + (1 - activity) * 0.42 * (1 - hunger * 0.5);
  U[Act.Explore] = 0.06 + (ph[P + T.Curiosity] as number) * 0.12;
  // Nothing worth eating around: go and look elsewhere.
  if (hunger > 0.3) U[Act.Explore] = (U[Act.Explore] as number) + foodDrive * 0.35 * (1 - sat(Math.max(grazeRate, forageRate), basalNeed));
  if (caps & Cap.Dig && adult && (sim.world.terrain.burrow[sim.world.terrain.index(homeX, homeY)] as number) < 0.8) {
    U[Act.Dig] = 0.12 + (season === Season.Autumn || season === Season.Winter ? 0.25 : 0) * (1 - hunger);
  }
  if (caps & Cap.Store && season === Season.Autumn && energyFrac > 0.7) U[Act.Store] = 0.3;
  if (caps & Cap.Migrate && (season === Season.Autumn || season === Season.Spring)) U[Act.Migrate] = 0.12 * (ph[P + T.Curiosity] as number);
  if (caps & Cap.Hibernate && season === Season.Winter && (o.thermal[i] as number) < -0.15 && energyFrac > 0.35) U[Act.Hibernate] = 0.95;
  // Winter caches.
  if ((o.cache[i] as number) > 0.5 && hunger > 0.3) U[Act.Store] = Math.max(U[Act.Store] as number, foodDrive * 0.8);

  // --- Customs: pushed by the player, followed according to plasticity and innate inclination ---
  const ls = sim.lineage(o.lineage[i] as number);
  let stress = 0;
  if (ls.custom !== 0) {
    const def = CUSTOMS[ls.custom];
    if (def) {
      const plast = der[Q + D.Plasticity] as number;
      let align = 0;
      for (const [t, sign] of def.innate) align += sign > 0 ? (ph[P + t] as number) : 1 - (ph[P + t] as number);
      align /= Math.max(1, def.innate.length);
      const follow = Math.min(1, plast * 0.7 + align * 0.6);
      for (const [act, mult] of def.boost) U[act] = (U[act] as number) * (1 + (mult - 1) * follow) + 0.05 * follow;
      // Acting against one's inclination is costly; those born inclined pay nothing (Baldwin effect).
      stress = Math.max(0, 0.65 - align) * (1 - 0.5 * plast) * 0.35;
    }
  }
  o.habitStress[i] = stress;

  // Small noise breaks ties and lockstep.
  let best = Act.Rest;
  let bestU = -1;
  for (let a = 0; a < ACT_COUNT; a++) {
    const u = (U[a] as number) + rng.float() * 0.02;
    if (u > bestU) {
      bestU = u;
      best = a;
    }
  }
  if (best !== Act.Graze && grazeCell >= 0 && grazeRate > 0) {
    // Remember a good spot for later.
    if (grazeRate > (o.memFoodQ[i] as number) * 0.8) {
      o.memFoodX[i] = (grazeCell % sim.width) + 0.5;
      o.memFoodY[i] = Math.floor(grazeCell / sim.width) + 0.5;
      o.memFoodQ[i] = grazeRate;
    }
  }
  setAction(sim, i, best, { threatJ, preyJ, mateJ, rivalJ, youngJ, grazeCell, carcass, gx, gy, gn, motherNear });
}

interface Targets {
  threatJ: number;
  preyJ: number;
  mateJ: number;
  rivalJ: number;
  youngJ: number;
  grazeCell: number;
  carcass: number;
  gx: number;
  gy: number;
  gn: number;
  motherNear: number;
}

function setTarget(sim: ParcelSim, i: number, j: number): void {
  sim.org.target[i] = j;
  sim.org.targetId[i] = j >= 0 ? (sim.org.id[j] as number) : 0;
}

function setAction(sim: ParcelSim, i: number, act: Act, t: Targets): void {
  const o = sim.org;
  const x = o.x[i] as number;
  const y = o.y[i] as number;
  const rng = sim.rngBehavior;
  const w = sim.width;
  const terrain = sim.world.terrain;
  o.action[i] = act;
  setTarget(sim, i, -1);
  o.tx[i] = x;
  o.ty[i] = y;
  // Leaving a hiding place or burrow.
  if (act !== Act.Hide && act !== Act.Rest && act !== Act.Hibernate) o.flags[i] = (o.flags[i] as number) & ~(Flag.Hidden | Flag.Burrowed);
  switch (act) {
    case Act.Graze:
      o.tx[i] = (t.grazeCell % w) + 0.2 + rng.float() * 0.6;
      o.ty[i] = Math.floor(t.grazeCell / w) + 0.2 + rng.float() * 0.6;
      break;
    case Act.Drink: {
      const c = sim.world.access.nearestWater[terrain.index(x, y)] as number;
      if (c >= 0) {
        o.tx[i] = (c % w) + 0.5;
        o.ty[i] = Math.floor(c / w) + 0.5;
      }
      break;
    }
    case Act.Flee: {
      const j = t.threatJ;
      let dx = x - (o.x[j] as number);
      let dy = y - (o.y[j] as number);
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      // Climbers run for the trees, others for cover if it is close.
      const sc = sim.world.access.nearestShelter[terrain.index(x, y)] as number;
      const sd = sim.world.access.shelterDistance[terrain.index(x, y)] as number;
      if (sc >= 0 && sd < 4) {
        o.tx[i] = (sc % w) + 0.5;
        o.ty[i] = Math.floor(sc / w) + 0.5;
      } else {
        o.tx[i] = x + dx * 8;
        o.ty[i] = y + dy * 8;
      }
      setTarget(sim, i, j);
      break;
    }
    case Act.Hunt: {
      setTarget(sim, i, t.preyJ);
      // The prey reacts if it notices the hunter.
      const j = t.preyJ;
      const dj = Math.hypot((o.x[j] as number) - x, (o.y[j] as number) - y);
      if (dj < sim.der(j, D.Perception) * detectability(sim, i)) o.nextThink[j] = Math.min(o.nextThink[j] as number, sim.tick + 1);
      break;
    }
    case Act.Scavenge:
      o.tx[i] = sim.world.carcasses.x[t.carcass] as number;
      o.ty[i] = sim.world.carcasses.y[t.carcass] as number;
      break;
    case Act.Court:
      setTarget(sim, i, t.mateJ);
      break;
    case Act.FollowGroup:
      if (t.motherNear >= 0 && !sim.isAdult(i)) {
        o.tx[i] = (o.x[t.motherNear] as number) + rng.range(-0.8, 0.8);
        o.ty[i] = (o.y[t.motherNear] as number) + rng.range(-0.8, 0.8);
      } else if (t.gn > 0) {
        o.tx[i] = t.gx / t.gn + rng.range(-1, 1);
        o.ty[i] = t.gy / t.gn + rng.range(-1, 1);
      }
      break;
    case Act.Defend:
      setTarget(sim, i, t.rivalJ);
      break;
    case Act.CareYoung:
      setTarget(sim, i, t.youngJ);
      break;
    case Act.Hide:
    case Act.Hibernate: {
      const home = terrain.index(o.homeX[i] as number, o.homeY[i] as number);
      if (act === Act.Hibernate && (terrain.burrow[home] as number) > 0.3) {
        o.tx[i] = o.homeX[i] as number;
        o.ty[i] = o.homeY[i] as number;
        break;
      }
      const c = sim.world.access.nearestShelter[terrain.index(x, y)] as number;
      if (c >= 0) {
        o.tx[i] = (c % w) + 0.5;
        o.ty[i] = Math.floor(c / w) + 0.5;
      }
      break;
    }
    case Act.Explore: {
      const ls = sim.lineage(o.lineage[i] as number);
      const range = 4 + 10 * (o.pheno[i * TRAIT_COUNT + T.Curiosity] as number);
      let a = rng.float() * Math.PI * 2;
      if (ls.custom === Custom.Expand && t.gn > 0) {
        // Expand: head away from the crowd.
        a = Math.atan2(y - t.gy / t.gn, x - t.gx / t.gn) + rng.range(-0.7, 0.7);
      }
      o.tx[i] = x + Math.cos(a) * range;
      o.ty[i] = y + Math.sin(a) * range;
      break;
    }
    case Act.Dig:
      o.tx[i] = o.homeX[i] as number;
      o.ty[i] = o.homeY[i] as number;
      break;
    case Act.Store:
      if ((o.cache[i] as number) > 0.5) {
        o.tx[i] = o.homeX[i] as number;
        o.ty[i] = o.homeY[i] as number;
      } else if (t.grazeCell >= 0) {
        o.tx[i] = (t.grazeCell % w) + 0.5;
        o.ty[i] = Math.floor(t.grazeCell / w) + 0.5;
      }
      break;
    case Act.Migrate: {
      // Seasonal range: warmer lowlands in autumn, back to the remembered range in spring.
      const season = seasonOf(sim.tick);
      let bx = x;
      let by = y;
      let bs = -Infinity;
      for (let s = 0; s < 12; s++) {
        const cx = rng.float() * sim.width;
        const cy = rng.float() * sim.height;
        const c = terrain.index(cx, cy);
        const score =
          season === Season.Autumn
            ? (terrain.baseTemp[c] as number) - Math.hypot(cx - x, cy - y) * 0.05
            : plantRateAt(sim, i, c) * 40 - Math.hypot(cx - x, cy - y) * 0.03;
        if (score > bs) {
          bs = score;
          bx = cx;
          by = cy;
        }
      }
      o.tx[i] = bx;
      o.ty[i] = by;
      o.homeX[i] = bx;
      o.homeY[i] = by;
      break;
    }
    default:
      break;
  }
  // Clamp targets into the parcel.
  o.tx[i] = Math.min(sim.width - 0.01, Math.max(0, o.tx[i] as number));
  o.ty[i] = Math.min(sim.height - 0.01, Math.max(0, o.ty[i] as number));
}
