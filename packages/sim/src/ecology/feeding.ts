import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { Cap } from '../organisms/capabilities';
import { T, TRAIT_COUNT } from '../genetics/traits';
import { Death, Food } from '../behavior/actions';
import { Biome } from '../world/terrain';
import { FaunaKind } from '../world/fauna';

/** Best plant food at cell `c` for organism `i`: energy per tick and the food type. */
export function plantRateAt(sim: ParcelSim, i: number, c: number): number {
  return bestPlant(sim, i, c, false);
}

/** Eats one bite of the best plant at cell `c`. Returns energy gained. */
export function eatPlantAt(sim: ParcelSim, i: number, c: number): number {
  return bestPlant(sim, i, c, true);
}

function bestPlant(sim: ParcelSim, i: number, c: number, consume: boolean): number {
  const o = sim.org;
  const veg = sim.world.vegetation;
  const q = i * DERIVED_COUNT;
  const der = o.derived;
  const bite =
    sim.cfg.organisms.biteCoeff * (der[q + D.M075] as number) * (o.feedShare[i] as number);
  const biome = sim.world.terrain.biome[c] as number;
  const grass = (veg.biomass[0] as Float32Array)[c] as number;
  const shrub = (veg.biomass[1] as Float32Array)[c] as number;
  const tree = (veg.biomass[2] as Float32Array)[c] as number;
  const algae = (veg.biomass[3] as Float32Array)[c] as number;
  const fruit = veg.fruit[c] as number;
  const caps = o.capabilities[i] as number;
  const mass = o.mass[i] as number;
  const thorny = veg.thorny[c] ? 0.6 : 1;

  let best = 0;
  let bestType = -1;
  let bestAmount = 0;
  // Only the grazeable top part of a plant can be eaten at once.
  const options: Array<[Food, number, number]> = OPTIONS;
  options[0]![1] = Math.min(grass * 0.6, bite);
  options[0]![2] = der[q + D.EffGrass] as number;
  options[1]![1] = Math.min(shrub * 0.4, bite);
  options[1]![2] = (der[q + D.EffBrowse] as number) * thorny;
  options[2]![1] = Math.min(fruit, bite);
  options[2]![2] = der[q + D.EffFruit] as number;
  const canopyReach = caps & Cap.Climb || mass > 12 ? 1 : 0;
  options[3]![1] = canopyReach ? Math.min(tree * 0.15, bite) : 0;
  options[3]![2] = der[q + D.EffCanopy] as number;
  const inWater = biome === Biome.ShallowWater || (biome === Biome.DeepWater && caps & Cap.Swim);
  options[4]![1] = inWater ? Math.min(algae * 0.5, bite) : 0;
  options[4]![2] = der[q + D.EffAlgae] as number;
  for (let k = 0; k < 5; k++) {
    const opt = options[k]!;
    const v = opt[1] * opt[2];
    if (v > best) {
      best = v;
      bestType = opt[0];
      bestAmount = opt[1];
    }
  }
  if (!consume || bestType < 0) return best;
  switch (bestType) {
    case Food.Grass:
      (veg.biomass[0] as Float32Array)[c] = grass - bestAmount;
      o.hydration[i] = Math.min(1, (o.hydration[i] as number) + 0.004);
      break;
    case Food.Browse:
      (veg.biomass[1] as Float32Array)[c] = shrub - bestAmount;
      if (veg.thorny[c]) o.health[i] = (o.health[i] as number) - 0.0015;
      break;
    case Food.Fruit:
      veg.fruit[c] = fruit - bestAmount;
      o.hydration[i] = Math.min(1, (o.hydration[i] as number) + 0.015);
      break;
    case Food.Canopy:
      (veg.biomass[2] as Float32Array)[c] = tree - bestAmount;
      break;
    case Food.Algae:
      (veg.biomass[3] as Float32Array)[c] = algae - bestAmount;
      break;
  }
  // Plant toxins (browse and fruit), amplified during toxic blooms.
  if (
    bestType === Food.Browse ||
    bestType === Food.Fruit ||
    (bestType === Food.Algae && sim.plantToxicity > 1)
  ) {
    const tol = o.pheno[i * TRAIT_COUNT + T.PlantToxinTolerance] as number;
    const dose =
      (bestType === Food.Browse ? 0.25 : bestType === Food.Algae ? 0.2 : 0.12) *
      sim.plantToxicity *
      (1 - tol);
    if (dose > 0.2) {
      o.health[i] = (o.health[i] as number) - (dose - 0.2) * 0.02;
      o.dmgCause[i] = Death.Toxin;
    }
  }
  o.lastFood[i] = bestType;
  sim.stats.onEat(i, bestType, best);
  return best;
}

const OPTIONS: Array<[Food, number, number]> = [
  [Food.Grass, 0, 0],
  [Food.Browse, 0, 0],
  [Food.Fruit, 0, 0],
  [Food.Canopy, 0, 0],
  [Food.Algae, 0, 0],
];

/** Catch efficiency per background fauna kind for organism `i`. */
function faunaEfficiency(sim: ParcelSim, i: number, kind: FaunaKind): number {
  const o = sim.org;
  const p = i * TRAIT_COUNT;
  const mass = o.mass[i] as number;
  const carn = o.pheno[p + T.Carnivory] as number;
  const speed = sim.der(i, D.MaxSpeed);
  switch (kind) {
    case FaunaKind.Insects:
      // Small, nimble animals catch insects; large ones barely bother.
      return (0.3 + 0.5 * carn) / (1 + mass / 3);
    case FaunaKind.SmallHerbivores:
      return (
        carn *
        Math.min(1.4, speed / 0.24) *
        (0.5 + 0.5 * Math.min(1, mass / 3)) *
        (0.6 + 0.4 * (o.pheno[p + T.Smell] as number))
      );
    case FaunaKind.Fish: {
      const swim = o.capabilities[i]! & Cap.Swim ? 1 : 0.2;
      return carn * swim;
    }
  }
}

/** Energy per tick from hunting background fauna here. */
export function faunaRate(
  sim: ParcelSim,
  i: number,
  x: number,
  y: number,
  consume: boolean,
): number {
  const o = sim.org;
  const fauna = sim.world.fauna;
  const q = i * DERIVED_COUNT;
  const bite = sim.cfg.organisms.biteCoeff * 0.7 * (o.derived[q + D.M075] as number);
  const effMeat = o.derived[q + D.EffMeat] as number;
  let best = 0;
  let bestKind = -1;
  const nearWater = sim.world.access.waterDistance[sim.world.terrain.index(x, y)]! < 2;
  for (let k = 0; k < 3; k++) {
    if (k === FaunaKind.Fish && !nearWater) continue;
    const dens = fauna.densityAt(k, x, y);
    const catchEff = faunaEfficiency(sim, i, k);
    // Encounter rate saturates with density.
    const amount = (bite * dens) / (dens + 3);
    const v = amount * catchEff * effMeat;
    if (v > best) {
      best = v;
      bestKind = k;
    }
  }
  if (consume && bestKind >= 0) {
    const dens = fauna.densityAt(bestKind, x, y);
    const catchEff = faunaEfficiency(sim, i, bestKind as FaunaKind);
    const got = fauna.take(bestKind as FaunaKind, x, y, ((bite * dens) / (dens + 3)) * catchEff);
    const gain = got * effMeat;
    const food = bestKind === 0 ? Food.Insects : bestKind === 1 ? Food.SmallPrey : Food.Fish;
    o.lastFood[i] = food;
    sim.stats.onEat(i, food, gain);
    return gain;
  }
  return best;
}
