import type { ParcelSim } from '../parcel';
import { TRAIT_COUNT } from '../genetics/traits';
import { Flag } from '../behavior/actions';

/** Contact transmission from infected `i` to `j`. */
export function tryInfect(sim: ParcelSim, i: number, j: number): void {
  const o = sim.org;
  if (o.infection[j]) return;
  const strainId = (o.infection[i] as number) - 1;
  if (((o.immune[j] as number) >> strainId) & 1) return;
  const strain = sim.strains.get(strainId);
  if (!strain) return;
  const res = o.pheno[j * TRAIT_COUNT + strain.resistance] as number;
  if (sim.rngEcology.float() < strain.transmissibility * (1 - res) * (1 - res))
    infect(sim, j, strainId);
}

export function infect(sim: ParcelSim, j: number, strainId: number): void {
  const o = sim.org;
  const strain = sim.strains.get(strainId);
  if (!strain || o.infection[j]) return;
  o.infection[j] = strainId + 1;
  o.infectionTimer[j] = strain.duration;
  o.flags[j] = (o.flags[j] as number) | Flag.Infected;
  sim.stats.onInfection(j, strainId);
}
