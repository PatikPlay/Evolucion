/**
 * Binary messages (server → client): frames of creature positions, terrain,
 * vegetation and background fauna. Each message starts with a kind byte.
 * Layouts are little-endian.
 */

export const enum BinaryKind {
  Frame = 1,
  Terrain = 2,
  Vegetation = 3,
  Fauna = 4,
}

/** Coordinates are fixed point: cells × 256 (parcels are at most 255 cells wide). */
export const COORD_SCALE = 256;

/** Bytes per creature record in a frame. */
export const FRAME_RECORD_BYTES = 12;
const FRAME_HEADER_BYTES = 1 + 1 + 1 + 4 + 2;

/** One creature in a frame. */
export interface FrameRecord {
  id: number;
  x: number;
  y: number;
  /** Heading in radians. */
  heading: number;
  anim: number;
  flags: number;
  /** Growth towards adult size, 0–255. */
  growth: number;
}

export interface Frame {
  /** Parcel the coordinates refer to. */
  parcel: number;
  /** Stream this frame belongs to (0 live, 1 timelapse, 2+ clips). */
  stream: number;
  tick: number;
  records: FrameRecord[];
}

/** Writes frames without allocating per record. */
export class FrameWriter {
  private buf: ArrayBuffer;
  private view: DataView;
  private count = 0;

  constructor(
    private readonly parcel: number,
    private readonly stream: number,
    private readonly tick: number,
    capacity: number,
  ) {
    this.buf = new ArrayBuffer(FRAME_HEADER_BYTES + capacity * FRAME_RECORD_BYTES);
    this.view = new DataView(this.buf);
  }

  push(
    id: number,
    x: number,
    y: number,
    heading: number,
    anim: number,
    flags: number,
    growth: number,
  ): void {
    const needed = FRAME_HEADER_BYTES + (this.count + 1) * FRAME_RECORD_BYTES;
    if (needed > this.buf.byteLength) {
      const next = new ArrayBuffer(Math.max(needed, this.buf.byteLength * 2));
      new Uint8Array(next).set(new Uint8Array(this.buf));
      this.buf = next;
      this.view = new DataView(next);
    }
    const o = FRAME_HEADER_BYTES + this.count * FRAME_RECORD_BYTES;
    const v = this.view;
    v.setUint32(o, id, true);
    v.setUint16(o + 4, clampU16(Math.round(x * COORD_SCALE)), true);
    v.setUint16(o + 6, clampU16(Math.round(y * COORD_SCALE)), true);
    let h = heading % (2 * Math.PI);
    if (h < 0) h += 2 * Math.PI;
    v.setUint8(o + 8, Math.round((h / (2 * Math.PI)) * 255) & 255);
    v.setUint8(o + 9, anim & 255);
    v.setUint8(o + 10, flags & 255);
    v.setUint8(o + 11, growth < 0 ? 0 : growth > 255 ? 255 : growth | 0);
    this.count++;
  }

  finish(): ArrayBuffer {
    const v = this.view;
    v.setUint8(0, BinaryKind.Frame);
    v.setUint8(1, this.parcel);
    v.setUint8(2, this.stream);
    v.setUint32(3, this.tick, true);
    v.setUint16(7, this.count, true);
    return this.buf.slice(0, FRAME_HEADER_BYTES + this.count * FRAME_RECORD_BYTES);
  }
}

function clampU16(v: number): number {
  return v < 0 ? 0 : v > 65535 ? 65535 : v;
}

export function binaryKind(buf: ArrayBuffer): BinaryKind {
  return new DataView(buf).getUint8(0) as BinaryKind;
}

export function decodeFrame(buf: ArrayBuffer): Frame {
  const v = new DataView(buf);
  if (v.getUint8(0) !== BinaryKind.Frame) throw new Error('not a frame');
  const parcel = v.getUint8(1);
  const stream = v.getUint8(2);
  const tick = v.getUint32(3, true);
  const count = v.getUint16(7, true);
  const records: FrameRecord[] = new Array(count);
  for (let k = 0; k < count; k++) {
    const o = FRAME_HEADER_BYTES + k * FRAME_RECORD_BYTES;
    records[k] = {
      id: v.getUint32(o, true),
      x: v.getUint16(o + 4, true) / COORD_SCALE,
      y: v.getUint16(o + 6, true) / COORD_SCALE,
      heading: (v.getUint8(o + 8) / 255) * 2 * Math.PI,
      anim: v.getUint8(o + 9),
      flags: v.getUint8(o + 10),
      growth: v.getUint8(o + 11),
    };
  }
  return { parcel, stream, tick, records };
}

/** Static terrain of a parcel: biome, shading (elevation) and player modifications. */
export interface TerrainGrid {
  parcel: number;
  width: number;
  height: number;
  biome: Uint8Array;
  /** Elevation quantised to 0–255 (for shading). */
  elevation: Uint8Array;
  /** 0 none, 1 hedge, 2 trench. */
  barrier: Uint8Array;
  /** Bit 0 refuge, bit 1 burrow, bit 2 enclosure. */
  marks: Uint8Array;
}

export function encodeTerrain(t: TerrainGrid): ArrayBuffer {
  const n = t.width * t.height;
  const buf = new ArrayBuffer(6 + n * 4);
  const v = new DataView(buf);
  v.setUint8(0, BinaryKind.Terrain);
  v.setUint8(1, t.parcel);
  v.setUint16(2, t.width, true);
  v.setUint16(4, t.height, true);
  const u = new Uint8Array(buf);
  u.set(t.biome, 6);
  u.set(t.elevation, 6 + n);
  u.set(t.barrier, 6 + 2 * n);
  u.set(t.marks, 6 + 3 * n);
  return buf;
}

export function decodeTerrain(buf: ArrayBuffer): TerrainGrid {
  const v = new DataView(buf);
  if (v.getUint8(0) !== BinaryKind.Terrain) throw new Error('not terrain');
  const width = v.getUint16(2, true);
  const height = v.getUint16(4, true);
  const n = width * height;
  const u = new Uint8Array(buf);
  return {
    parcel: v.getUint8(1),
    width,
    height,
    biome: u.slice(6, 6 + n),
    elevation: u.slice(6 + n, 6 + 2 * n),
    barrier: u.slice(6 + 2 * n, 6 + 3 * n),
    marks: u.slice(6 + 3 * n, 6 + 4 * n),
  };
}

/** Plant cover per cell, quantised 0–255 relative to a fixed scale (what you would see). */
export interface VegetationGrid {
  parcel: number;
  tick: number;
  width: number;
  height: number;
  grass: Uint8Array;
  shrub: Uint8Array;
  tree: Uint8Array;
  algae: Uint8Array;
  fruit: Uint8Array;
}

const VEG_LAYERS = 5;

export function encodeVegetation(g: VegetationGrid): ArrayBuffer {
  const n = g.width * g.height;
  const buf = new ArrayBuffer(10 + n * VEG_LAYERS);
  const v = new DataView(buf);
  v.setUint8(0, BinaryKind.Vegetation);
  v.setUint8(1, g.parcel);
  v.setUint32(2, g.tick, true);
  v.setUint16(6, g.width, true);
  v.setUint16(8, g.height, true);
  const u = new Uint8Array(buf);
  u.set(g.grass, 10);
  u.set(g.shrub, 10 + n);
  u.set(g.tree, 10 + 2 * n);
  u.set(g.algae, 10 + 3 * n);
  u.set(g.fruit, 10 + 4 * n);
  return buf;
}

export function decodeVegetation(buf: ArrayBuffer): VegetationGrid {
  const v = new DataView(buf);
  if (v.getUint8(0) !== BinaryKind.Vegetation) throw new Error('not vegetation');
  const width = v.getUint16(6, true);
  const height = v.getUint16(8, true);
  const n = width * height;
  const u = new Uint8Array(buf);
  return {
    parcel: v.getUint8(1),
    tick: v.getUint32(2, true),
    width,
    height,
    grass: u.slice(10, 10 + n),
    shrub: u.slice(10 + n, 10 + 2 * n),
    tree: u.slice(10 + 2 * n, 10 + 3 * n),
    algae: u.slice(10 + 3 * n, 10 + 4 * n),
    fruit: u.slice(10 + 4 * n, 10 + 5 * n),
  };
}

/** Background fauna density per block (insects, small herbivores, fish), 0–255. */
export interface FaunaGrid {
  parcel: number;
  tick: number;
  blockSize: number;
  bw: number;
  bh: number;
  insects: Uint8Array;
  small: Uint8Array;
  fish: Uint8Array;
}

export function encodeFauna(g: FaunaGrid): ArrayBuffer {
  const n = g.bw * g.bh;
  const buf = new ArrayBuffer(11 + n * 3);
  const v = new DataView(buf);
  v.setUint8(0, BinaryKind.Fauna);
  v.setUint8(1, g.parcel);
  v.setUint32(2, g.tick, true);
  v.setUint8(6, g.blockSize);
  v.setUint16(7, g.bw, true);
  v.setUint16(9, g.bh, true);
  const u = new Uint8Array(buf);
  u.set(g.insects, 11);
  u.set(g.small, 11 + n);
  u.set(g.fish, 11 + 2 * n);
  return buf;
}

export function decodeFauna(buf: ArrayBuffer): FaunaGrid {
  const v = new DataView(buf);
  if (v.getUint8(0) !== BinaryKind.Fauna) throw new Error('not fauna');
  const bw = v.getUint16(7, true);
  const bh = v.getUint16(9, true);
  const n = bw * bh;
  const u = new Uint8Array(buf);
  return {
    parcel: v.getUint8(1),
    tick: v.getUint32(2, true),
    blockSize: v.getUint8(6),
    bw,
    bh,
    insects: u.slice(11, 11 + n),
    small: u.slice(11 + n, 11 + 2 * n),
    fish: u.slice(11 + 2 * n, 11 + 3 * n),
  };
}
