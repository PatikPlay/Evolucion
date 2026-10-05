import type { Rng } from './rng';

/** Lineage ids 0..NPC_LINEAGE_BASE-1 belong to players; the rest to NPC species. */
export const NPC_LINEAGE_BASE = 100;

export interface SpeciesInfo {
  readonly id: number;
  readonly lineage: number;
  readonly parent: number;
  name: string;
  readonly bornTick: number;
  /** Absolute round/tick bookkeeping is done by the game; the sim only stores ticks. */
  extinctTick: number;
  /** Capabilities ever shown by at least one individual. */
  capsSeen: number;
  /** Capabilities that have been common (>25 % of the species). */
  capsCommon: number;
  /** Template key for NPC species (archetype), empty for player lineages. */
  readonly archetype: string;
}

export class SpeciesRegistry {
  readonly list: SpeciesInfo[] = [];
  private next = 1;

  create(lineage: number, parent: number, name: string, tick: number, archetype = ''): SpeciesInfo {
    const sp: SpeciesInfo = { id: this.next++, lineage, parent, name, bornTick: tick, extinctTick: -1, capsSeen: 0, capsCommon: 0, archetype };
    this.list.push(sp);
    return sp;
  }

  get(id: number): SpeciesInfo | undefined {
    return this.list[id - 1];
  }

  ofLineage(lineage: number): SpeciesInfo[] {
    return this.list.filter((s) => s.lineage === lineage);
  }

  /** Continues numbering after species created in another parcel (keeps ids globally unique). */
  reserve(nextId: number): void {
    this.next = Math.max(this.next, nextId);
  }
}

const SYLLABLES_A = ['ca', 'lo', 'mi', 'ra', 'te', 'xu', 'fe', 'no', 'pa', 'si', 've', 'tu', 'gra', 'phy', 'chi', 'lu', 'dor', 'mar', 'ri', 'zo'];
const SYLLABLES_B = ['li', 'ra', 'ne', 'to', 'sa', 'mo', 'di', 'cu', 'pe', 'va', 'ri', 'go', 'thi', 'xa'];
const GENUS_END = ['us', 'ia', 'on', 'ax', 'ops', 'ella', 'odon', 'urus', 'ix', 'ides'];
const EPITHET_END = ['ensis', 'atus', 'icus', 'osa', 'alis', 'ifer', 'oides', 'inus', 'ina', 'ens'];

/** Generates a pseudo-Latin binomial name, e.g. "Calorax velatus". */
export function speciesName(rng: Rng, genus?: string): string {
  const g =
    genus ??
    capitalise(rng.pick(SYLLABLES_A) + rng.pick(SYLLABLES_B) + rng.pick(GENUS_END));
  const e = rng.pick(SYLLABLES_A) + rng.pick(SYLLABLES_B) + rng.pick(EPITHET_END);
  return `${g} ${e}`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
