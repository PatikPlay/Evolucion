import type { ParcelSim } from '../parcel';
import { CAPABILITIES } from '../organisms/capabilities';
import { LOCI } from '../genetics/genome-map';

export type MomentKind =
  | 'firstCapability'
  | 'macromutant'
  | 'packHunt'
  | 'massDeath'
  | 'speciation'
  | 'invasion'
  | 'corridorCrossing'
  | 'event';

/** A notable moment detected by the simulation. Its clip is cut by the recorder. */
export interface Moment {
  readonly tick: number;
  readonly kind: MomentKind;
  readonly x: number;
  readonly y: number;
  /** Organism id at the centre of the moment (0 if none). */
  readonly subject: number;
  readonly species: number;
  readonly lineage: number;
  /** Higher = more important (used to keep the best clips). */
  readonly importance: number;
  readonly detail: string;
}

/** Collects notable moments with simple per-kind cooldowns. */
export class MomentLog {
  readonly list: Moment[] = [];
  private lastByKey = new Map<string, number>();
  private recentDeaths = new Map<number, number[]>();
  /** Called whenever a moment is added (the recorder starts a clip). */
  onMoment: ((m: Moment) => void) | null = null;

  add(m: Moment, cooldownKey?: string, cooldown = 0): void {
    if (cooldownKey) {
      const last = this.lastByKey.get(cooldownKey);
      if (last !== undefined && m.tick - last < cooldown) return;
      this.lastByKey.set(cooldownKey, m.tick);
    }
    this.list.push(m);
    this.onMoment?.(m);
  }

  onSpawn(sim: ParcelSim, i: number): void {
    const o = sim.org;
    const info = sim.species.get(o.species[i] as number);
    if (!info) return;
    const bits = o.capabilities[i] as number;
    const fresh = bits & ~info.capsSeen;
    if (!fresh) return;
    info.capsSeen |= fresh;
    // Founders define the baseline; only capabilities that appear later are moments.
    if (o.generation[i] === 0) return;
    for (const c of CAPABILITIES) {
      if (fresh & c.bit) {
        this.add({ tick: sim.tick, kind: 'firstCapability', x: o.x[i] as number, y: o.y[i] as number, subject: o.id[i] as number, species: info.id, lineage: info.lineage, importance: 8, detail: c.key });
      }
    }
  }

  macromutant(sim: ParcelSim, i: number, locus: number): void {
    const o = sim.org;
    this.add(
      { tick: sim.tick, kind: 'macromutant', x: o.x[i] as number, y: o.y[i] as number, subject: o.id[i] as number, species: o.species[i] as number, lineage: o.lineage[i] as number, importance: 5, detail: LOCI[locus]?.key ?? '' },
      `macro-${o.species[i]}`,
      200,
    );
  }

  packHunt(sim: ParcelSim, hunter: number, prey: number, size: number): void {
    const o = sim.org;
    this.add(
      { tick: sim.tick, kind: 'packHunt', x: o.x[prey] as number, y: o.y[prey] as number, subject: o.id[hunter] as number, species: o.species[hunter] as number, lineage: o.lineage[hunter] as number, importance: 6, detail: String(size) },
      `pack-${o.species[hunter]}`,
      600,
    );
  }

  onDeath(sim: ParcelSim, i: number, cause: number): void {
    const o = sim.org;
    const sp = o.species[i] as number;
    let list = this.recentDeaths.get(sp);
    if (!list) {
      list = [];
      this.recentDeaths.set(sp, list);
    }
    list.push(sim.tick);
    while (list.length > 0 && sim.tick - (list[0] as number) > 40) list.shift();
    if (list.length >= 12) {
      const alive = sim.speciesPop.get(sp) ?? 0;
      if (list.length > 0.12 * (alive + list.length)) {
        this.add(
          { tick: sim.tick, kind: 'massDeath', x: o.x[i] as number, y: o.y[i] as number, subject: o.id[i] as number, species: sp, lineage: o.lineage[i] as number, importance: 9, detail: String(cause) },
          `mass-${sp}`,
          400,
        );
      }
    }
  }
}
