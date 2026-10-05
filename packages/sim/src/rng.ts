/**
 * Seeded pseudo-random number generation.
 *
 * `sfc32` (Small Fast Chaotic, Chris Doty-Humphrey) seeded through `cyrb128`.
 * Every subsystem draws from its own named stream so that adding a draw in one
 * place never shifts the sequence seen by another.
 */

/** Hashes a string into four 32-bit words (cyrb128 by bryc). */
export function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Joins path segments into a stream key: `seedKey('abc', 'parcel', 2)` → `abc/parcel/2`. */
export function seedKey(...parts: ReadonlyArray<string | number>): string {
  return parts.join('/');
}

export type RngState = readonly [number, number, number, number];

const TWO_POW_32 = 4294967296;

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  /** The key this stream was created from; forks extend it. */
  readonly key: string;

  constructor(key: string, state?: RngState) {
    this.key = key;
    const s = state ?? cyrb128(key);
    this.a = s[0] | 0;
    this.b = s[1] | 0;
    this.c = s[2] | 0;
    this.d = s[3] | 0;
    if (!state) {
      // Warm up so that similar keys diverge immediately.
      for (let i = 0; i < 15; i++) this.nextU32();
    }
  }

  /** A child stream derived from this stream's key (not from its current position). */
  fork(...parts: ReadonlyArray<string | number>): Rng {
    return new Rng(seedKey(this.key, ...parts));
  }

  nextU32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform in [0, 1). */
  float(): number {
    return this.nextU32() / TWO_POW_32;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.float();
  }

  /** Integer uniform in [0, n). */
  int(n: number): number {
    return Math.floor(this.float() * n);
  }

  /** Integer uniform in [min, max] (inclusive). */
  intRange(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  chance(p: number): boolean {
    return this.float() < p;
  }

  /** Standard normal via Box–Muller (one value per call; no hidden cache, so state stays serialisable). */
  normal(): number {
    let u = this.float();
    if (u < 1e-12) u = 1e-12;
    const v = this.float();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  gaussian(mean: number, sd: number): number {
    return mean + sd * this.normal();
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick on empty array');
    return items[this.int(items.length)] as T;
  }

  /** Picks an index with probability proportional to its weight. Returns -1 if all weights are 0. */
  weightedIndex(weights: ArrayLike<number>): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i] as number);
    if (total <= 0) return -1;
    let r = this.float() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= Math.max(0, weights[i] as number);
      if (r < 0) return i;
    }
    return weights.length - 1;
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(state: RngState): void {
    this.a = state[0] | 0;
    this.b = state[1] | 0;
    this.c = state[2] | 0;
    this.d = state[3] | 0;
  }
}
