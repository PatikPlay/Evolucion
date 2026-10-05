import {
  NPC_LINEAGE_BASE,
  ParcelSim,
  Rng,
  TICKS_PER_YEAR,
  censusOf,
  isNight,
  randomFounderTemplate,
  seasonOf,
} from '@linaje/sim';
import { PREDATOR_TEMPLATE } from '@linaje/sim/archetypes';
import {
  creatureDef,
  describe,
  encodeFaunaView,
  encodeFrame,
  encodeTerrainView,
  encodeVegetationView,
  ownerSlot,
} from '@linaje/game';
import type { SpectateMsg } from '@linaje/protocol';
import type { ClientChannel } from './transport';

/** Live view of one parcel (development viewer and H2 rendering target). */
export class LiveSession {
  readonly sim: ParcelSim;
  private speed = 20;
  private timer: ReturnType<typeof setInterval> | null = null;
  private known = new Set<number>();
  private speciesCount = 0;
  private carry = 0;
  private predatorSpecies = -1;

  constructor(
    private readonly ch: ClientChannel,
    private readonly req: SpectateMsg,
  ) {
    this.sim = new ParcelSim({ seed: req.seed });
    this.sim.stats.maxSamples = 4000;
    // Each seed gets its own founder population (as players will choose theirs).
    this.sim.spawnFounders(randomFounderTemplate(new Rng(`${req.seed}/founders`)), 40, 0);
    if (req.scenario === 'cold') this.sim.apply({ type: 'climate', tempAnomaly: -5 });
    for (let y = 0; y < req.years; y++) {
      this.applyScenario();
      this.sim.run(TICKS_PER_YEAR);
    }
  }

  private applyScenario(): void {
    if (this.req.scenario !== 'predators') return;
    const sim = this.sim;
    const prey = sim.count({ lineage: 0 });
    const preds = this.predatorSpecies < 0 ? 0 : sim.count({ species: this.predatorSpecies });
    const wanted = Math.max(6, Math.round(prey * 0.08));
    if (preds < wanted) {
      this.predatorSpecies = sim.spawnFounders(
        PREDATOR_TEMPLATE,
        wanted - preds,
        NPC_LINEAGE_BASE,
        {
          ...(this.predatorSpecies >= 0 ? { species: this.predatorSpecies } : {}),
          archetype: 'predator',
        },
      );
    }
  }

  start(): void {
    const sim = this.sim;
    this.ch.send({
      t: 'parcel',
      parcel: 0,
      width: sim.width,
      height: sim.height,
      ox: 0,
      oy: 0,
      owner: 0,
    });
    this.ch.sendBinary(encodeTerrainView(sim, 0));
    this.sendSpecies();
    this.sendNewCreatures();
    this.ch.sendBinary(encodeVegetationView(sim, 0));
    this.ch.sendBinary(encodeFaunaView(sim, 0));
    this.ch.sendBinary(encodeFrame(sim, 0, 0));
    this.sendClock();
    this.timer = setInterval(() => this.pump(), 50);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0, Math.min(400, speed));
    this.sendClock();
  }

  private pump(): void {
    if (!this.ch.open) return this.stop();
    this.carry += this.speed / 20;
    const steps = Math.floor(this.carry);
    this.carry -= steps;
    const sim = this.sim;
    for (let s = 0; s < steps; s++) {
      if (sim.tick % TICKS_PER_YEAR === 0) this.applyScenario();
      sim.step();
      if (sim.tick % 40 === 0) this.ch.sendBinary(encodeVegetationView(sim, 0));
      if (sim.tick % 100 === 0) this.ch.sendBinary(encodeFaunaView(sim, 0));
      if (sim.tick % 20 === 0) this.sendClock();
    }
    if (steps > 0) {
      this.sendNewCreatures();
      if (sim.species.list.length !== this.speciesCount) this.sendSpecies();
      this.ch.sendBinary(encodeFrame(sim, 0, 0));
      if (this.ch.debug && sim.tick % 40 < steps) this.sendDebugStats();
    }
  }

  private sendClock(): void {
    const tick = this.sim.tick;
    this.ch.send({
      t: 'clock',
      tick,
      season: seasonOf(tick),
      year: Math.floor(tick / TICKS_PER_YEAR),
      night: isNight(tick),
      speed: this.speed,
    });
  }

  private sendSpecies(): void {
    const list = this.sim.species.list.map((s) => ({
      id: s.id,
      name: s.name,
      own: ownerSlot(s.lineage),
      parent: s.parent,
      extinct: s.extinctTick >= 0,
    }));
    this.speciesCount = list.length;
    this.ch.send({ t: 'species', list });
  }

  private sendNewCreatures(): void {
    const sim = this.sim;
    const defs: number[][] = [];
    const alive = new Set<number>();
    for (let i = 0; i < sim.org.high; i++) {
      if (!sim.org.alive[i]) continue;
      const id = sim.org.id[i] as number;
      alive.add(id);
      if (!this.known.has(id)) defs.push(creatureDef(sim, i));
    }
    for (const id of this.known) if (!alive.has(id)) this.known.delete(id);
    for (const d of defs) this.known.add(d[0] as number);
    if (defs.length) this.ch.send({ t: 'creatures', defs });
  }

  inspect(id: number): void {
    const sim = this.sim;
    let slot = -1;
    for (let i = 0; i < sim.org.high; i++) {
      if (sim.org.alive[i] && sim.org.id[i] === id) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      this.ch.send({ t: 'inspect', id, found: false, species: 0, descriptors: [] });
      return;
    }
    this.ch.send({
      t: 'inspect',
      id,
      found: true,
      species: sim.org.species[slot] as number,
      descriptors: describe(sim, slot),
    });
    if (this.ch.debug) {
      const o = sim.org;
      this.ch.send({
        t: 'debug',
        kind: 'organism',
        data: {
          id,
          energy: o.energy[slot],
          hydration: o.hydration[slot],
          health: o.health[slot],
          age: sim.age(slot),
          generation: o.generation[slot],
          delLoad: o.delLoad[slot],
          pheno: Array.from(o.pheno.subarray(slot * 50, slot * 50 + 50)).map((v) => +v.toFixed(3)),
        },
      });
    }
  }

  private sendDebugStats(): void {
    const sim = this.sim;
    const data = sim.species.list
      .filter((s) => (sim.speciesPop.get(s.id) ?? 0) > 0)
      .map((s) => {
        const c = censusOf(sim, sim.living({ species: s.id }), s.id, s.lineage);
        return {
          species: s.id,
          name: s.name,
          count: c.count,
          adults: c.adults,
          massMean: +c.massMean.toFixed(2),
          speedMean: +c.speedMean.toFixed(3),
          diversity: +c.diversity.toFixed(3),
          generation: +c.generationMean.toFixed(1),
        };
      });
    this.ch.send({ t: 'debug', kind: 'species', data });
  }
}
