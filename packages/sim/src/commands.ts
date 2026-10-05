import type { ParcelSim, Region } from './parcel';
import type { SpeciesTemplate } from './genetics/templates';
import { Custom } from './behavior/customs';
import { Death } from './behavior/actions';

/**
 * Inputs from the game layer. Everything that changes a parcel from outside
 * goes through a command, so a match can be replayed from its command log.
 */
export type SimCommand =
  | {
      type: 'spawn';
      template: SpeciesTemplate;
      count: number;
      lineage: number;
      species?: number;
      region?: Region;
      name?: string;
      archetype?: string;
    }
  | { type: 'climate'; tempAnomaly?: number; moistureFactor?: number; seasonalMult?: number; winterAnomaly?: number }
  | { type: 'cull'; lineage?: number; species?: number; keep: number }
  | { type: 'setCustom'; lineage: number; custom: Custom }
  | { type: 'lineageMods'; lineage: number; canalisation?: number; mutationMult?: number; feeding?: number; selectTrait?: number; selectDir?: number };

export function applyCommand(sim: ParcelSim, cmd: SimCommand): void {
  switch (cmd.type) {
    case 'spawn':
      sim.spawnFounders(cmd.template, cmd.count, cmd.lineage, {
        ...(cmd.region ? { region: cmd.region } : {}),
        ...(cmd.species !== undefined ? { species: cmd.species } : {}),
        ...(cmd.name ? { name: cmd.name } : {}),
        ...(cmd.archetype ? { archetype: cmd.archetype } : {}),
      });
      break;
    case 'climate': {
      const c = sim.world.climate;
      if (cmd.tempAnomaly !== undefined) c.tempAnomaly = cmd.tempAnomaly;
      if (cmd.moistureFactor !== undefined) c.moistureFactor = cmd.moistureFactor;
      if (cmd.seasonalMult !== undefined) c.seasonalMult = cmd.seasonalMult;
      if (cmd.winterAnomaly !== undefined) c.winterAnomaly = cmd.winterAnomaly;
      c.update(sim.tick);
      break;
    }
    case 'cull': {
      // Random survivors (a bottleneck).
      const filter: { lineage?: number; species?: number } = {};
      if (cmd.lineage !== undefined) filter.lineage = cmd.lineage;
      if (cmd.species !== undefined) filter.species = cmd.species;
      const alive = sim.living(filter);
      sim.rngEcology.shuffle(alive);
      for (let k = cmd.keep; k < alive.length; k++) sim.kill(alive[k] as number, Death.Culled, false);
      break;
    }
    case 'setCustom':
      sim.lineage(cmd.lineage).custom = cmd.custom;
      break;
    case 'lineageMods': {
      const l = sim.lineage(cmd.lineage);
      if (cmd.canalisation !== undefined) l.canalisation = cmd.canalisation;
      if (cmd.mutationMult !== undefined) l.mutationMult = cmd.mutationMult;
      if (cmd.feeding !== undefined) l.feeding = cmd.feeding;
      if (cmd.selectTrait !== undefined) l.selectTrait = cmd.selectTrait;
      if (cmd.selectDir !== undefined) l.selectDir = cmd.selectDir;
      break;
    }
  }
}
