export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function logit(p: number): number {
  const q = clamp(p, 1e-4, 1 - 1e-4);
  return Math.log(q / (1 - q));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Response curve used by the utility AI: 0 below `lo`, 1 above `hi`, smooth in between. */
export function ramp(x: number, lo: number, hi: number): number {
  return smoothstep(lo, hi, x);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Signed smallest difference between two angles, in [-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Circular distance between two hues in [0, 1). Result in [0, 0.5]. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
}

export function mean(values: ArrayLike<number>): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i] as number;
  return s / values.length;
}

export function variance(values: ArrayLike<number>): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    const d = (values[i] as number) - m;
    s += d * d;
  }
  return s / (values.length - 1);
}
