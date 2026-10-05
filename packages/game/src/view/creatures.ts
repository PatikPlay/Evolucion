import {
  D,
  DERIVED_COUNT,
  Flag,
  NPC_LINEAGE_BASE,
  T,
  TRAIT_COUNT,
  legsFromTrait,
  traitFromMass,
  type ParcelSim,
} from '@linaje/sim';
import { FrameFlag, FrameWriter, V, VISUAL_COUNT, quantise } from '@linaje/protocol';

/** Visible traits drawn by the client, in protocol order (see VISUAL_KEYS). */
const TRAIT_FOR_VISUAL: ReadonlyArray<readonly [number, T]> = [
  [V.elongation, T.Elongation],
  [V.legLength, T.LegLength],
  [V.legStrength, T.LegStrength],
  [V.prehensile, T.Prehensile],
  [V.fins, T.Fins],
  [V.membranes, T.Membranes],
  [V.armor, T.Armor],
  [V.spines, T.Spines],
  [V.tail, T.Tail],
  [V.fur, T.Fur],
  [V.hue, T.Hue],
  [V.lightness, T.Lightness],
  [V.conspicuous, T.Conspicuous],
  [V.spots, T.Spots],
  [V.stripes, T.Stripes],
  [V.eyes, T.EyeSize],
];

/** Owner slot as seen by clients: player lineages keep their index, wild species are 255. */
export function ownerSlot(lineage: number): number {
  return lineage < NPC_LINEAGE_BASE ? lineage : 255;
}

/**
 * Drawing definition of organism `i`: [id, species, owner, ...visual levels].
 * Only visible traits, quantised to 16 levels.
 */
export function creatureDef(sim: ParcelSim, i: number): number[] {
  const o = sim.org;
  const p = i * TRAIT_COUNT;
  const out = new Array<number>(3 + VISUAL_COUNT).fill(0);
  out[0] = o.id[i] as number;
  out[1] = o.species[i] as number;
  out[2] = ownerSlot(o.lineage[i] as number);
  const v = (k: number, val: number) => (out[3 + k] = val);
  v(V.size, quantise(traitFromMass(o.derived[i * DERIVED_COUNT + D.AdultMassPotential] as number)));
  v(V.legCount, legsFromTrait(o.pheno[p + T.LegCount] as number) / 2);
  for (const [k, t] of TRAIT_FOR_VISUAL) v(k, quantise(o.pheno[p + t] as number));
  return out;
}

/** Visible state flags of organism `i`. */
export function frameFlags(sim: ParcelSim, i: number): number {
  const o = sim.org;
  const f = o.flags[i] as number;
  let out = 0;
  if (!sim.isAdult(i)) out |= FrameFlag.Juvenile;
  if (f & Flag.Swimming) out |= FrameFlag.Swimming;
  if (f & Flag.Climbing) out |= FrameFlag.Climbing;
  if (f & Flag.Burrowed) out |= FrameFlag.Burrowed;
  if (f & Flag.Hidden) out |= FrameFlag.Hidden;
  if (f & Flag.Limping) out |= FrameFlag.Limping;
  if (f & Flag.Pregnant) out |= FrameFlag.Pregnant;
  if ((o.energy[i] as number) < (o.derived[i * DERIVED_COUNT + D.MaxEnergy] as number) * 0.25)
    out |= FrameFlag.Thin;
  return out;
}

/** Body size relative to the adult potential, 0–255 (200 = full adult size). */
export function growthByte(sim: ParcelSim, i: number): number {
  const o = sim.org;
  return Math.round(
    (200 * (o.mass[i] as number)) / (o.derived[i * DERIVED_COUNT + D.AdultMassPotential] as number),
  );
}

/** Encodes a frame with the organisms selected by `include` (all by default). */
export function encodeFrame(
  sim: ParcelSim,
  parcel: number,
  stream: number,
  include?: (i: number) => boolean,
): ArrayBuffer {
  const o = sim.org;
  const w = new FrameWriter(parcel, stream, sim.tick, o.liveCount);
  for (let i = 0; i < o.high; i++) {
    if (!o.alive[i]) continue;
    if (include && !include(i)) continue;
    w.push(
      o.id[i] as number,
      o.x[i] as number,
      o.y[i] as number,
      o.heading[i] as number,
      o.action[i] as number,
      frameFlags(sim, i),
      growthByte(sim, i),
    );
  }
  return w.finish();
}

/**
 * Qualitative field-card descriptors (i18n keys). What a naturalist could
 * tell by looking at the animal for a while: no numbers, no hidden traits.
 */
export function describe(sim: ParcelSim, i: number): string[] {
  const o = sim.org;
  const q = i * DERIVED_COUNT;
  const out: string[] = [];
  const age = sim.age(i);
  const maturity = o.derived[q + D.Maturity] as number;
  const life = o.derived[q + D.Lifespan] as number;
  out.push(age < maturity ? 'stage.juvenile' : age > life * 0.8 ? 'stage.elder' : 'stage.adult');
  out.push(o.sex[i] === 0 ? 'sex.female' : 'sex.male');
  // Build relative to the others of its species.
  const sample = sim.stats.latest(o.species[i] as number);
  const typical = sample && sample.massMean > 0 ? sample.massMean : (o.mass[i] as number);
  if (age >= maturity) {
    const rel = (o.mass[i] as number) / typical;
    out.push(
      rel < 0.75
        ? 'build.slight'
        : rel > 1.3
          ? 'build.large'
          : rel > 1.1
            ? 'build.robust'
            : 'build.average',
    );
  }
  const e = (o.energy[i] as number) / (o.derived[q + D.MaxEnergy] as number);
  out.push(
    e < 0.15
      ? 'condition.starving'
      : e < 0.35
        ? 'condition.thin'
        : e > 0.75
          ? 'condition.wellFed'
          : 'condition.fed',
  );
  if ((o.hydration[i] as number) < 0.3) out.push('condition.thirsty');
  const f = o.flags[i] as number;
  if (f & Flag.Limping) out.push('state.limping');
  if (o.infection[i] && (o.health[i] as number) < 0.85) out.push('state.looksSick');
  if (f & Flag.Pregnant) out.push('state.pregnant');
  if (f & Flag.Hibernating) out.push('state.torpid');
  if ((o.thermal[i] as number) < -0.3) out.push('state.shivering');
  else if ((o.thermal[i] as number) > 0.3) out.push('state.panting');
  out.push((o.huddle[i] as number) >= 2 ? 'social.inGroup' : 'social.alone');
  return out;
}
