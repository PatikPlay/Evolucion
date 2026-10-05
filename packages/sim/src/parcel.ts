import { Rng, seedKey } from './rng';
import { StateHasher } from './hash';
import { mergeConfig, type DeepPartial, type SimConfig } from './config';
import { createWorld, type World } from './world/world';
import { OrganismStore, D, DERIVED_COUNT } from './organisms/store';
import { SpatialGrid } from './organisms/spatial';
import { computeDerived, refreshMass } from './organisms/derived';
import { ALLELES_PER_GENOME } from './genetics/genome-map';
import { deleteriousLoad, expressGenome } from './genetics/genome';
import { sampleFounders, type SpeciesTemplate } from './genetics/templates';
import { T, TRAIT_COUNT, massFromTrait } from './genetics/traits';
import { SpeciesRegistry, speciesName } from './species';
import { ENDEMIC_STRAIN, StrainRegistry } from './ecology/disease';
import { Death, Flag } from './behavior/actions';
import { Custom } from './behavior/customs';
import { think } from './behavior/think';
import { execute } from './behavior/execute';
import { updatePhysiology } from './ecology/physiology';
import { giveBirth, type Litter } from './ecology/reproduction';
import { StatsRecorder } from './stats/stats';
import { MomentLog } from './stats/moments';
import { applyCommand, type SimCommand } from './commands';
import { Biome, isWater } from './world/terrain';

export interface ParcelOptions {
  seed: string;
  parcelIndex?: number;
  config?: DeepPartial<SimConfig>;
}

export interface Region {
  x: number;
  y: number;
  r: number;
}

/** Per-lineage modifiers set by game rules (customs, adaptive radiation, directed selection…). */
export interface LineageState {
  custom: Custom;
  /** Cryptic-locus expression (0.15 normally, 1 during adaptive radiation). */
  canalisation: number;
  mutationMult: number;
  /** Directed selection: favoured trait and direction (0 = none). */
  selectTrait: number;
  selectDir: number;
  /** Supplemental feeding: free energy fraction of basal metabolism. */
  feeding: number;
}

/**
 * One parcel of the world: terrain, plants, background fauna and every
 * organism living in it. A pure, deterministic function of its seed and the
 * commands applied to it.
 */
export class ParcelSim {
  readonly cfg: SimConfig;
  readonly seed: string;
  readonly parcelIndex: number;
  tick = 0;
  readonly world: World;
  readonly org: OrganismStore;
  readonly grid: SpatialGrid;
  readonly species = new SpeciesRegistry();
  readonly strains = new StrainRegistry();
  readonly stats: StatsRecorder;
  readonly moments: MomentLog;
  readonly pendingLitters = new Map<number, Litter>();
  readonly lineages = new Map<number, LineageState>();
  /** Live individuals per species, maintained on spawn and death. */
  readonly speciesPop = new Map<number, number>();
  /** Plant toxicity multiplier (toxic blooms). */
  plantToxicity = 1;
  readonly rngBehavior: Rng;
  readonly rngGenetics: Rng;
  readonly rngEcology: Rng;
  readonly rngSpawn: Rng;
  readonly rngNames: Rng;

  constructor(opts: ParcelOptions) {
    this.cfg = mergeConfig(opts.config);
    this.seed = opts.seed;
    this.parcelIndex = opts.parcelIndex ?? 0;
    const root = new Rng(seedKey(opts.seed, 'parcel', this.parcelIndex));
    this.world = createWorld(root.fork('world'), this.cfg);
    this.org = new OrganismStore(this.cfg.organisms.initialCapacity);
    this.grid = new SpatialGrid(this.cfg.world.width, this.cfg.world.height, 4);
    this.rngBehavior = root.fork('behavior');
    this.rngGenetics = root.fork('genetics');
    this.rngEcology = root.fork('ecology');
    this.rngSpawn = root.fork('spawn');
    this.rngNames = root.fork('names');
    this.strains.add(ENDEMIC_STRAIN);
    this.stats = new StatsRecorder(this);
    this.moments = new MomentLog();
    this.world.climate.update(0);
  }

  get width(): number {
    return this.cfg.world.width;
  }

  get height(): number {
    return this.cfg.world.height;
  }

  lineage(id: number): LineageState {
    let l = this.lineages.get(id);
    if (!l) {
      l = { custom: Custom.None, canalisation: this.cfg.genetics.canalisation, mutationMult: 1, selectTrait: -1, selectDir: 0, feeding: 0 };
      this.lineages.set(id, l);
    }
    return l;
  }

  /** Advances exactly one fixed tick. */
  step(): void {
    const tick = this.tick;
    this.world.update(tick, this.cfg);
    const o = this.org;
    this.grid.rebuild(o.alive, o.x, o.y, o.high);
    const high = o.high;
    for (let i = 0; i < high; i++) {
      if (!o.alive[i]) continue;
      if (tick >= (o.nextThink[i] as number)) think(this, i);
      if (!o.alive[i]) continue;
      execute(this, i);
      if (!o.alive[i]) continue;
      updatePhysiology(this, i);
      if (o.alive[i] && (o.flags[i] as number) & Flag.Pregnant && tick >= (o.pregnantUntil[i] as number)) giveBirth(this, i);
    }
    if (tick % this.cfg.stats.interval === 0) this.stats.sample();
    this.tick++;
  }

  run(ticks: number): void {
    for (let t = 0; t < ticks; t++) this.step();
  }

  apply(command: SimCommand): void {
    applyCommand(this, command);
  }

  /** Age of organism `i` in ticks. */
  age(i: number): number {
    return this.tick - (this.org.birthTick[i] as number);
  }

  isAdult(i: number): boolean {
    return this.age(i) >= (this.org.derived[i * DERIVED_COUNT + D.Maturity] as number);
  }

  trait(i: number, t: T): number {
    return this.org.pheno[i * TRAIT_COUNT + t] as number;
  }

  der(i: number, d: D): number {
    return this.org.derived[i * DERIVED_COUNT + d] as number;
  }

  /** Creates a new species record with a generated name. */
  newSpecies(lineage: number, parent = 0, archetype = '', name?: string) {
    return this.species.create(lineage, parent, name ?? speciesName(this.rngNames), this.tick, archetype);
  }

  /**
   * Creates an organism from a genome. `adult` founders start mature with a
   * spread of ages; newborns start at birth mass.
   */
  spawn(
    alleles: Float32Array,
    aOff: number,
    del0: number,
    del1: number,
    species: number,
    lineage: number,
    x: number,
    y: number,
    opts: { adult: boolean; generation?: number; motherId?: number; fatherId?: number; motherIdx?: number; birthMassFrac?: number; macro?: boolean },
  ): number {
    const o = this.org;
    const i = o.allocate();
    o.alleles.set(alleles.subarray(aOff, aOff + ALLELES_PER_GENOME), i * ALLELES_PER_GENOME);
    o.delet[2 * i] = del0;
    o.delet[2 * i + 1] = del1;
    o.delLoad[i] = deleteriousLoad(del0, del1);
    o.species[i] = species;
    o.lineage[i] = lineage;
    o.sex[i] = this.rngSpawn.int(2);
    o.generation[i] = opts.generation ?? 0;
    o.motherId[i] = opts.motherId ?? 0;
    o.fatherId[i] = opts.fatherId ?? 0;
    o.motherIdx[i] = opts.motherIdx ?? -1;
    o.x[i] = x;
    o.y[i] = y;
    o.homeX[i] = x;
    o.homeY[i] = y;
    o.heading[i] = this.rngSpawn.float() * Math.PI * 2;
    if (opts.macro) o.flags[i] = (o.flags[i] as number) | Flag.Macromutant;
    const ls = this.lineage(lineage);
    expressGenome(o.alleles, i * ALLELES_PER_GENOME, o.pheno, i * TRAIT_COUNT, ls.canalisation);
    const q = i * DERIVED_COUNT;
    // Mass must be set before derived values that depend on it.
    const pot = massFromTrait(o.pheno[i * TRAIT_COUNT + T.Mass] as number);
    if (opts.adult) {
      o.mass[i] = pot * (0.85 + 0.15 * this.rngSpawn.float());
      o.nutrition[i] = 0.8;
    } else {
      o.mass[i] = pot * (opts.birthMassFrac ?? 0.08);
    }
    o.birthMass[i] = o.mass[i] as number;
    computeDerived(o, i, this.cfg);
    if (opts.adult) {
      const mat = o.derived[q + D.Maturity] as number;
      const life = o.derived[q + D.Lifespan] as number;
      o.birthTick[i] = this.tick - Math.floor(mat + this.rngSpawn.float() * Math.max(1, life * 0.4 - mat * 0.3));
    } else {
      o.birthTick[i] = this.tick;
    }
    refreshMass(o, i, this.cfg);
    o.energy[i] = (o.derived[q + D.MaxEnergy] as number) * (opts.adult ? 0.75 : 0.85);
    o.hydration[i] = 0.9;
    o.health[i] = o.derived[q + D.Viability] as number;
    o.nextThink[i] = this.tick + (o.id[i]! % this.cfg.organisms.thinkInterval);
    o.memFoodX[i] = x;
    o.memFoodY[i] = y;
    o.memThreatTick[i] = -100000;
    this.speciesPop.set(species, (this.speciesPop.get(species) ?? 0) + 1);
    this.stats.onBirth(i);
    this.moments.onSpawn(this, i);
    return i;
  }

  /** Spawns a founder population from a template. Returns the species id. */
  spawnFounders(tpl: SpeciesTemplate, count: number, lineage: number, opts: { region?: Region; species?: number; name?: string; archetype?: string } = {}): number {
    const sp = opts.species ?? this.newSpecies(lineage, 0, opts.archetype ?? '', opts.name).id;
    const ls = this.lineage(lineage);
    const genomes = sampleFounders(tpl, count, this.rngGenetics.fork('founders', sp, this.tick), ls.canalisation, this.cfg.genetics.standingVariation);
    // Founders arrive together, as a small colony in a habitable spot.
    const region = opts.region ?? this.colonySite(14);
    this.spawnGenomes(genomes.alleles, genomes.delet, genomes.count, sp, lineage, region, true);
    return sp;
  }

  /** Spawns pre-made genomes (founders, colonists, migrants). */
  spawnGenomes(alleles: Float32Array, delet: Uint32Array, count: number, species: number, lineage: number, region: Region | undefined, adult: boolean): number[] {
    const slots: number[] = [];
    for (let n = 0; n < count; n++) {
      const [x, y] = this.randomLandPoint(region);
      slots.push(this.spawn(alleles, n * ALLELES_PER_GENOME, delet[2 * n] as number, delet[2 * n + 1] as number, species, lineage, x, y, { adult }));
    }
    return slots;
  }

  /** A good colony site: rich in plants and close to water. */
  colonySite(radius: number): Region {
    const t = this.world.terrain;
    let best: Region = { x: t.width / 2, y: t.height / 2, r: radius };
    let bestScore = -Infinity;
    for (let k = 0; k < 40; k++) {
      const [x, y] = this.randomLandPoint();
      const c = t.index(x, y);
      const veg = this.world.vegetation;
      const food = (veg.capacity[0] as Float32Array)[c]! + (veg.capacity[1] as Float32Array)[c]! + veg.fruit[c]!;
      const water = this.world.access.waterDistance[c] as number;
      const edge = Math.min(x, y, t.width - x, t.height - y);
      const score = Math.min(food, 25) - 2 * Math.max(0, water - 5) + Math.min(0, edge - radius) + this.rngSpawn.float();
      if (score > bestScore) {
        bestScore = score;
        best = { x, y, r: radius };
      }
    }
    return best;
  }

  /** A random walkable point, inside `region` when possible. */
  randomLandPoint(region?: Region): [number, number] {
    const t = this.world.terrain;
    for (let attempt = 0; attempt < 200; attempt++) {
      let x: number;
      let y: number;
      if (region) {
        const a = this.rngSpawn.float() * Math.PI * 2;
        const r = Math.sqrt(this.rngSpawn.float()) * region.r;
        x = region.x + Math.cos(a) * r;
        y = region.y + Math.sin(a) * r;
      } else {
        x = this.rngSpawn.float() * t.width;
        y = this.rngSpawn.float() * t.height;
      }
      if (!t.inBounds(x, y)) continue;
      const c = t.index(x, y);
      const b = t.biome[c] as number;
      if (isWater(b) || t.barrier[c]) continue;
      if (attempt < 150 && b === Biome.Rock) continue;
      return [x, y];
    }
    return [t.width / 2, t.height / 2];
  }

  /** Removes organism `i`, recording the cause and leaving a carcass. */
  kill(i: number, cause: Death, leaveCarcass = true): void {
    const o = this.org;
    if (!o.alive[i]) return;
    this.stats.onDeath(i, cause);
    this.moments.onDeath(this, i, cause);
    if (leaveCarcass && cause !== Death.Culled) {
      this.world.carcasses.add(o.x[i] as number, o.y[i] as number, (o.mass[i] as number) * this.cfg.predation.meatPerMass * 0.7, this.trait(i, T.ToxinProduction), o.lineage[i] as number, this.trait(i, T.Hue));
    }
    this.pendingLitters.delete(o.id[i] as number);
    const sp = o.species[i] as number;
    this.speciesPop.set(sp, (this.speciesPop.get(sp) ?? 1) - 1);
    o.release(i);
  }

  /** Live slots, optionally filtered by lineage or species. */
  living(filter?: { lineage?: number; species?: number }): number[] {
    const o = this.org;
    const out: number[] = [];
    for (let i = 0; i < o.high; i++) {
      if (!o.alive[i]) continue;
      if (filter?.lineage !== undefined && o.lineage[i] !== filter.lineage) continue;
      if (filter?.species !== undefined && o.species[i] !== filter.species) continue;
      out.push(i);
    }
    return out;
  }

  count(filter?: { lineage?: number; species?: number }): number {
    return this.living(filter).length;
  }

  stateHash(): number {
    const o = this.org;
    const h = new StateHasher().number(this.tick).number(o.high).number(o.liveCount);
    h.typedPrefix(o.alive, o.high).typedPrefix(o.id, o.high).typedPrefix(o.x, o.high).typedPrefix(o.y, o.high);
    h.typedPrefix(o.energy, o.high).typedPrefix(o.health, o.high).typedPrefix(o.alleles, o.high * ALLELES_PER_GENOME);
    for (const b of this.world.vegetation.biomass) h.typed(b);
    h.typed(new Uint32Array(this.rngBehavior.getState())).typed(new Uint32Array(this.rngGenetics.getState()));
    return h.digest();
  }
}
