/** Debug: ASCII map with organism positions. `tsx popmap.ts seed years`. */
import { ParcelSim, TICKS_PER_YEAR } from '../src/index';
const seed = process.argv[2] ?? 'b';
const sim = new ParcelSim({ seed });
sim.spawnFounders({ key: 'base', traits: {} }, 30, 0);
sim.run(TICKS_PER_YEAR * Number(process.argv[3] ?? 5));
const t = sim.world.terrain;
const grid: string[][] = [];
const chars = ['.', 'T', '*', ':', '^', '~', '≈'];
for (let y = 0; y < t.height; y += 2) {
  const row: string[] = [];
  for (let x = 0; x < t.width; x++) row.push(chars[t.biome[y * t.width + x]!]!);
  grid.push(row);
}
for (const i of sim.living()) {
  const gy = Math.floor(sim.org.y[i]! / 2);
  const gx = Math.floor(sim.org.x[i]!);
  grid[gy]![gx] = '@';
}
console.log(grid.map((r) => r.join('')).join('\n'));
console.log('n', sim.org.liveCount);
