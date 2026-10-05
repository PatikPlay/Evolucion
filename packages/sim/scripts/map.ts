/** Prints an ASCII map of a parcel: `tsx packages/sim/scripts/map.ts seed`. */
import { DEFAULT_SIM_CONFIG } from '../src/config';
import { Rng } from '../src/rng';
import { createWorld } from '../src/world/world';

const seed = process.argv[2] ?? 'map';
const w = createWorld(new Rng(seed), DEFAULT_SIM_CONFIG);
const chars = ['.', 'T', '*', ':', '^', '~', '≈'];
const t = w.terrain;
for (let y = 0; y < t.height; y += 2) {
  let line = '';
  for (let x = 0; x < t.width; x++) line += chars[t.biome[y * t.width + x] as number];
  console.log(line);
}
let far = 0;
for (let i = 0; i < t.size; i++) far = Math.max(far, w.access.waterDistance[i] as number);
console.log('max water distance', far, 'productivity', Math.round(w.vegetation.productivityEstimate()));
