import type { Rng } from '../rng';

/**
 * Seeded 2D value noise with smooth interpolation and fractal (fBm) layering.
 * Lattice values come from a permutation table so the result is a pure
 * function of the seed.
 */
export class ValueNoise2D {
  private readonly perm = new Uint16Array(512);
  private readonly values = new Float32Array(256);

  constructor(rng: Rng) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p.push(i);
      this.values[i] = rng.float();
    }
    rng.shuffle(p);
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255] as number;
  }

  private lattice(ix: number, iy: number): number {
    const a = this.perm[ix & 255] as number;
    return this.values[this.perm[(a + iy) & 511] as number] as number;
  }

  /** Noise in [0, 1). */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const v00 = this.lattice(x0, y0);
    const v10 = this.lattice(x0 + 1, y0);
    const v01 = this.lattice(x0, y0 + 1);
    const v11 = this.lattice(x0 + 1, y0 + 1);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }

  /** Fractal Brownian motion, normalised to [0, 1). */
  fbm(x: number, y: number, octaves: number, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.sample(x * freq + o * 17.3, y * freq + o * 31.7);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
