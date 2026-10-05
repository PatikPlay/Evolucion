import type { ParcelSim } from '../parcel';
import { D, DERIVED_COUNT } from '../organisms/store';
import { Cap } from '../organisms/capabilities';
import { T, TRAIT_COUNT } from '../genetics/traits';
import { Act, Death, Flag, Food } from '../behavior/actions';
import { power, resistance } from '../behavior/think';
import { gainEnergy } from '../behavior/execute';

const NEAR = new Int32Array(48);

/** Hunters of the same species attacking the same prey help each other. */
function packBonus(sim: ParcelSim, i: number, j: number): number {
  const o = sim.org;
  const n = sim.grid.query(o.x[j] as number, o.y[j] as number, 4, o.x, o.y, NEAR, i);
  let allies = 0;
  for (let k = 0; k < n; k++) {
    const h = NEAR[k] as number;
    if (o.species[h] === o.species[i] && o.action[h] === Act.Hunt && o.targetId[h] === o.id[j]) allies++;
  }
  if (allies === 0) return 1;
  const pack = (o.capabilities[i] as number) & Cap.PackHunt;
  if (pack && allies >= 2) sim.moments.packHunt(sim, i, j, allies + 1);
  return 1 + (pack ? 0.5 : 0.12) * Math.min(allies, 5);
}

/** Herding prey defend each other. */
function herdBonus(sim: ParcelSim, j: number): number {
  const o = sim.org;
  if (!((o.capabilities[j] as number) & Cap.Herd)) return 1;
  const n = sim.grid.query(o.x[j] as number, o.y[j] as number, 3, o.x, o.y, NEAR, j);
  let mates = 0;
  for (let k = 0; k < n; k++) if (o.species[NEAR[k] as number] === o.species[j]) mates++;
  return 1 + 0.12 * Math.min(mates, 6);
}

/** Learned aversion: eating something toxic teaches a predator to avoid prey that looks like it. */
export function poison(sim: ParcelSim, i: number, toxin: number, hue: number, amount: number): void {
  const o = sim.org;
  const cfg = sim.cfg.predation;
  const res = o.pheno[i * TRAIT_COUNT + T.ToxinResistance] as number;
  const dose = toxin * (1 - res);
  if (dose <= cfg.toxinThreshold) return;
  o.health[i] = (o.health[i] as number) - (dose - cfg.toxinThreshold) * cfg.toxinDamage * amount;
  o.dmgCause[i] = Death.Toxin;
  const plast = o.derived[i * DERIVED_COUNT + D.Plasticity] as number;
  o.aversionHue[i] = hue;
  o.aversion[i] = Math.min(1, (o.aversion[i] as number) + cfg.aversionLearning * dose * plast);
}

/** One attack attempt of hunter `i` on prey `j`. */
export function attack(sim: ParcelSim, i: number, j: number): void {
  const o = sim.org;
  const cfg = sim.cfg.predation;
  const rng = sim.rngEcology;
  // One strike every couple of ticks.
  if (rng.float() < 0.5) return;
  const pw = power(sim, i) * packBonus(sim, i, j);
  const rs = resistance(sim, j) * herdBonus(sim, j);
  const ratio = pw / (pw + rs);
  const pj = j * TRAIT_COUNT;
  // Biting a toxic animal hurts even if it escapes.
  const tox = o.pheno[pj + T.ToxinProduction] as number;
  poison(sim, i, tox, o.pheno[pj + T.Hue] as number, 0.5);
  if (rng.float() < cfg.killBase * ratio) {
    const mass = o.mass[j] as number;
    const x = o.x[j] as number;
    const y = o.y[j] as number;
    const hue = o.pheno[pj + T.Hue] as number;
    sim.stats.onKill(i, j);
    sim.kill(j, Death.Predation, false);
    const c = sim.world.carcasses.add(x, y, mass * cfg.meatPerMass, tox, o.lineage[j] as number, hue);
    if (c >= 0) {
      o.action[i] = Act.Scavenge;
      o.tx[i] = x;
      o.ty[i] = y;
    }
    o.nextThink[i] = sim.tick + 4;
  } else {
    o.health[j] = (o.health[j] as number) - 0.22 * ratio;
    o.dmgCause[j] = Death.Predation;
    o.health[i] = (o.health[i] as number) - (0.03 + 0.12 * (o.pheno[pj + T.Spines] as number) * (1 - ratio));
    o.dmgCause[i] = Death.Combat;
    o.fatigue[i] = Math.min(1, (o.fatigue[i] as number) + 0.12);
    o.nextThink[j] = sim.tick;
    if ((o.health[j] as number) <= 0) {
      sim.stats.onKill(i, j);
    }
  }
}

/** Eats one bite of carcass `c`. */
export function eatCarcass(sim: ParcelSim, i: number, c: number): void {
  const o = sim.org;
  const carc = sim.world.carcasses;
  const bite = sim.cfg.organisms.biteCoeff * (o.derived[i * DERIVED_COUNT + D.M075] as number);
  const got = carc.take(c, bite);
  const gain = got * (o.derived[i * DERIVED_COUNT + D.EffMeat] as number);
  gainEnergy(sim, i, gain);
  o.lastFood[i] = Food.Meat;
  sim.stats.onEat(i, Food.Meat, gain);
  const tox = carc.toxin[c] as number;
  if (tox > 0.05) poison(sim, i, tox, carc.hue[c] as number, got / Math.max(0.1, bite) * 0.15);
}

/** Territorial contest between `i` and `j`; the loser flees. */
export function fight(sim: ParcelSim, i: number, j: number): void {
  const o = sim.org;
  const rng = sim.rngEcology;
  const pi = power(sim, i) * (0.75 + 0.5 * rng.float());
  const pj = power(sim, j) * (0.75 + 0.5 * rng.float());
  const winner = pi >= pj ? i : j;
  const loser = winner === i ? j : i;
  const pw = Math.max(pi, pj);
  const pl = Math.min(pi, pj);
  o.health[loser] = (o.health[loser] as number) - (0.04 + 0.14 * (pw / (pw + pl)));
  o.dmgCause[loser] = Death.Combat;
  o.health[winner] = (o.health[winner] as number) - (0.02 + 0.08 * (o.pheno[loser * TRAIT_COUNT + T.Spines] as number));
  o.dmgCause[winner] = Death.Combat;
  o.fatigue[winner] = Math.min(1, (o.fatigue[winner] as number) + 0.1);
  o.action[loser] = Act.Flee;
  o.target[loser] = winner;
  o.targetId[loser] = o.id[winner] as number;
  const dx = (o.x[loser] as number) - (o.x[winner] as number);
  const dy = (o.y[loser] as number) - (o.y[winner] as number);
  const d = Math.hypot(dx, dy) || 1;
  o.tx[loser] = Math.min(sim.width - 0.01, Math.max(0, (o.x[loser] as number) + (dx / d) * 6));
  o.ty[loser] = Math.min(sim.height - 0.01, Math.max(0, (o.y[loser] as number) + (dy / d) * 6));
  o.nextThink[loser] = sim.tick + 10;
  o.flags[loser] = (o.flags[loser] as number) & ~Flag.Hidden;
  sim.stats.onFight(winner, loser);
}
