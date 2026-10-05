import { Rng, seedKey } from './rng';
import { StateHasher } from './hash';

/**
 * H0 skeleton of a parcel simulation: a fixed-step loop over a structure of
 * arrays. H1 replaces the placeholder walkers with the real ecosystem while
 * keeping this public surface (constructor options, step/run, stateHash).
 */
export interface ParcelOptions {
  seed: string;
  parcelIndex?: number;
  width?: number;
  height?: number;
}

export class ParcelSim {
  readonly width: number;
  readonly height: number;
  tick = 0;
  private readonly rng: Rng;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly count = 64;

  constructor(opts: ParcelOptions) {
    this.width = opts.width ?? 96;
    this.height = opts.height ?? 96;
    this.rng = new Rng(seedKey(opts.seed, 'parcel', opts.parcelIndex ?? 0, 'behavior'));
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      this.x[i] = this.rng.float() * this.width;
      this.y[i] = this.rng.float() * this.height;
    }
  }

  /** Advances exactly one fixed tick. */
  step(): void {
    for (let i = 0; i < this.count; i++) {
      const nx = (this.x[i] as number) + this.rng.normal() * 0.2;
      const ny = (this.y[i] as number) + this.rng.normal() * 0.2;
      this.x[i] = Math.min(this.width - 0.001, Math.max(0, nx));
      this.y[i] = Math.min(this.height - 0.001, Math.max(0, ny));
    }
    this.tick++;
  }

  run(ticks: number): void {
    for (let t = 0; t < ticks; t++) this.step();
  }

  stateHash(): number {
    return new StateHasher()
      .number(this.tick)
      .typed(this.x)
      .typed(this.y)
      .typed(new Uint32Array(this.rng.getState()))
      .digest();
  }
}
