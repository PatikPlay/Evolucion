import type { SimConfig } from '../config';
import { darkness, seasonalWave, yearPhase } from '../time';

/**
 * Parcel-wide climate state. Events change the anomalies; the per-tick
 * global offset is cached so per-cell temperature is a single addition.
 */
export class Climate {
  /** Added to every cell's temperature (cold waves, glaciation, heat waves). */
  tempAnomaly = 0;
  /** Multiplies moisture (drought < 1, floods > 1). */
  moistureFactor = 1;
  /** Multiplies the seasonal swing (longer, harsher winters). */
  seasonalMult = 1;
  /** Extra cooling applied only in winter (e.g. "winters are getting longer"). */
  winterAnomaly = 0;

  /** Cached global temperature offset for the current tick. */
  offsetNow = 0;
  /** Cached moisture multiplier for the current tick. */
  moistureNow = 1;
  darknessNow = 0;
  seasonalNow = 0;

  constructor(private readonly cfg: SimConfig) {}

  update(tick: number): void {
    const wave = seasonalWave(tick);
    this.seasonalNow = wave;
    const winter = wave < 0 ? -wave : 0;
    this.darknessNow = darkness(tick);
    this.offsetNow =
      this.cfg.climate.seasonalAmplitude * this.seasonalMult * wave +
      this.tempAnomaly -
      this.winterAnomaly * winter -
      this.cfg.climate.nightCooling * this.darknessNow;
    // Wetter in spring (phase ~0.1), drier late summer (~0.6).
    const phase = yearPhase(tick);
    this.moistureNow =
      this.moistureFactor *
      (1 + this.cfg.climate.moistureSwing * Math.cos(2 * Math.PI * (phase - 0.1)));
  }
}
