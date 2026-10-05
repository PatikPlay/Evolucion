import { ALLELES_PER_GENOME } from '../genetics/genome-map';
import { TRAIT_COUNT } from '../genetics/traits';

/** Quantities derived once per organism from its phenotype (some refreshed as juveniles grow). */
export const enum D {
  MaxSpeed = 0,
  Strength,
  Perception,
  NightPerception,
  Maturity,
  Lifespan,
  UpkeepMult,
  ComfortLow,
  ComfortHigh,
  Visibility,
  Legs,
  Endurance,
  Plasticity,
  Viability,
  MetabolicRate,
  AdultMassPotential,
  M075,
  MaxEnergy,
  EffGrass,
  EffBrowse,
  EffFruit,
  EffCanopy,
  EffAlgae,
  EffMeat,
  ThirstMult,
}
export const DERIVED_COUNT = 25;

type Typed = Float32Array | Int32Array | Uint32Array | Uint16Array | Uint8Array;

/**
 * Structure-of-arrays storage for every organism of a parcel (players' and
 * NPC lineages alike). Slots are reused through a LIFO free list, so slot
 * order — and therefore update order — is deterministic.
 */
export class OrganismStore {
  capacity: number;
  /** One past the highest slot ever used. Iterate `0..high` and check `alive`. */
  high = 0;
  liveCount = 0;
  nextId = 1;
  private free: number[] = [];

  alive!: Uint8Array;
  id!: Uint32Array;
  species!: Uint16Array;
  lineage!: Uint8Array;
  sex!: Uint8Array;
  flags!: Uint16Array;
  generation!: Uint16Array;
  birthTick!: Int32Array;
  motherId!: Uint32Array;
  fatherId!: Uint32Array;
  motherIdx!: Int32Array;
  x!: Float32Array;
  y!: Float32Array;
  heading!: Float32Array;
  speed!: Float32Array;
  action!: Uint8Array;
  target!: Int32Array;
  targetId!: Uint32Array;
  tx!: Float32Array;
  ty!: Float32Array;
  nextThink!: Int32Array;
  energy!: Float32Array;
  hydration!: Float32Array;
  health!: Float32Array;
  fatigue!: Float32Array;
  mass!: Float32Array;
  birthMass!: Float32Array;
  nutrition!: Float32Array;
  pregnantUntil!: Int32Array;
  cooldownUntil!: Int32Array;
  homeX!: Float32Array;
  homeY!: Float32Array;
  memFoodX!: Float32Array;
  memFoodY!: Float32Array;
  memFoodQ!: Float32Array;
  memThreatX!: Float32Array;
  memThreatY!: Float32Array;
  memThreatTick!: Int32Array;
  infection!: Uint8Array;
  infectionTimer!: Int32Array;
  immune!: Uint16Array;
  capabilities!: Uint16Array;
  delLoad!: Uint8Array;
  aversionHue!: Float32Array;
  aversion!: Float32Array;
  lastFood!: Uint8Array;
  thermal!: Float32Array;
  /** Accumulated deviation from innate inclinations imposed by the active custom. */
  habitStress!: Float32Array;
  /** Cause of the most recent damage, used when health reaches zero. */
  dmgCause!: Uint8Array;
  /** Food cached at home by organisms that store food. */
  cache!: Float32Array;
  /** Conspecifics close enough to huddle with (refreshed on think). */
  huddle!: Uint8Array;
  /** Share of feeding left after bigger neighbours push in (interference competition), 0–1. */
  feedShare!: Float32Array;
  alleles!: Float32Array;
  delet!: Uint32Array;
  pheno!: Float32Array;
  derived!: Float32Array;

  private static readonly SCALAR_FIELDS: ReadonlyArray<
    [keyof OrganismStore, new (n: number) => Typed, number]
  > = [
    ['alive', Uint8Array, 1],
    ['id', Uint32Array, 1],
    ['species', Uint16Array, 1],
    ['lineage', Uint8Array, 1],
    ['sex', Uint8Array, 1],
    ['flags', Uint16Array, 1],
    ['generation', Uint16Array, 1],
    ['birthTick', Int32Array, 1],
    ['motherId', Uint32Array, 1],
    ['fatherId', Uint32Array, 1],
    ['motherIdx', Int32Array, 1],
    ['x', Float32Array, 1],
    ['y', Float32Array, 1],
    ['heading', Float32Array, 1],
    ['speed', Float32Array, 1],
    ['action', Uint8Array, 1],
    ['target', Int32Array, 1],
    ['targetId', Uint32Array, 1],
    ['tx', Float32Array, 1],
    ['ty', Float32Array, 1],
    ['nextThink', Int32Array, 1],
    ['energy', Float32Array, 1],
    ['hydration', Float32Array, 1],
    ['health', Float32Array, 1],
    ['fatigue', Float32Array, 1],
    ['mass', Float32Array, 1],
    ['birthMass', Float32Array, 1],
    ['nutrition', Float32Array, 1],
    ['pregnantUntil', Int32Array, 1],
    ['cooldownUntil', Int32Array, 1],
    ['homeX', Float32Array, 1],
    ['homeY', Float32Array, 1],
    ['memFoodX', Float32Array, 1],
    ['memFoodY', Float32Array, 1],
    ['memFoodQ', Float32Array, 1],
    ['memThreatX', Float32Array, 1],
    ['memThreatY', Float32Array, 1],
    ['memThreatTick', Int32Array, 1],
    ['infection', Uint8Array, 1],
    ['infectionTimer', Int32Array, 1],
    ['immune', Uint16Array, 1],
    ['capabilities', Uint16Array, 1],
    ['delLoad', Uint8Array, 1],
    ['aversionHue', Float32Array, 1],
    ['aversion', Float32Array, 1],
    ['lastFood', Uint8Array, 1],
    ['thermal', Float32Array, 1],
    ['habitStress', Float32Array, 1],
    ['dmgCause', Uint8Array, 1],
    ['cache', Float32Array, 1],
    ['huddle', Uint8Array, 1],
    ['feedShare', Float32Array, 1],
    ['alleles', Float32Array, ALLELES_PER_GENOME],
    ['delet', Uint32Array, 2],
    ['pheno', Float32Array, TRAIT_COUNT],
    ['derived', Float32Array, DERIVED_COUNT],
  ];

  constructor(capacity = 2048) {
    this.capacity = capacity;
    for (const [key, Ctor, width] of OrganismStore.SCALAR_FIELDS) {
      (this as unknown as Record<string, Typed>)[key as string] = new Ctor(capacity * width);
    }
  }

  private grow(): void {
    const next = this.capacity * 2;
    for (const [key, Ctor, width] of OrganismStore.SCALAR_FIELDS) {
      const old = (this as unknown as Record<string, Typed>)[key as string] as Typed;
      const arr = new Ctor(next * width);
      arr.set(old as never);
      (this as unknown as Record<string, Typed>)[key as string] = arr;
    }
    this.capacity = next;
  }

  /** Allocates a slot, zeroes it and assigns a fresh id. */
  allocate(): number {
    let i: number;
    if (this.free.length > 0) {
      i = this.free.pop() as number;
    } else {
      if (this.high >= this.capacity) this.grow();
      i = this.high++;
    }
    for (const [key, , width] of OrganismStore.SCALAR_FIELDS) {
      const arr = (this as unknown as Record<string, Typed>)[key as string] as Typed;
      if (width === 1) arr[i] = 0;
      else arr.fill(0, i * width, (i + 1) * width);
    }
    this.alive[i] = 1;
    this.id[i] = this.nextId++;
    this.target[i] = -1;
    this.motherIdx[i] = -1;
    this.feedShare[i] = 1;
    this.liveCount++;
    return i;
  }

  release(i: number): void {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.liveCount--;
    this.free.push(i);
  }

  /** Slot of a live organism by id, verifying a cached slot first. */
  resolve(slot: number, id: number): number {
    if (slot >= 0 && slot < this.high && this.alive[slot] && this.id[slot] === id) return slot;
    return -1;
  }

  /** Free list in a serialisable form (for state hashing and save games). */
  freeList(): readonly number[] {
    return this.free;
  }
}
