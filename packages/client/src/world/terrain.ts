import type { TerrainGrid, VegetationGrid } from '@linaje/protocol';
import { BIOME_RGB } from './palette';

/** Pixels per cell in the terrain textures. */
export const CELL_PX = 8;

function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Watercolour terrain: soft biome washes, hill shading, darker water edges and paper grain. */
export function paintTerrain(t: TerrainGrid, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const W = t.width * CELL_PX;
  const H = t.height * CELL_PX;
  const c = canvas ?? document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;

  // 1. Per-cell washes on a small canvas, then upscaled with blur (bleeding pigment).
  const small = document.createElement('canvas');
  small.width = t.width;
  small.height = t.height;
  const sg = small.getContext('2d') as CanvasRenderingContext2D;
  const img = sg.createImageData(t.width, t.height);
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      const i = y * t.width + x;
      const b = t.biome[i] as number;
      const base = BIOME_RGB[b] ?? [200, 200, 200];
      // Hill shading from the elevation gradient (light from the north-west).
      const e = (t.elevation[i] as number) / 255;
      const ex = x > 0 ? (t.elevation[i - 1] as number) / 255 : e;
      const ey = y > 0 ? (t.elevation[i - t.width] as number) / 255 : e;
      const shade = b >= 5 ? 1 : 1 + (e - ex + (e - ey)) * 4 - (e - 0.5) * 0.08;
      const jitter = 0.94 + 0.12 * hash2(x, y, 1);
      img.data[i * 4] = Math.min(255, base[0] * shade * jitter);
      img.data[i * 4 + 1] = Math.min(255, base[1] * shade * jitter);
      img.data[i * 4 + 2] = Math.min(255, base[2] * shade * jitter);
      img.data[i * 4 + 3] = 255;
    }
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.filter = `blur(${CELL_PX * 0.6}px)`;
  g.drawImage(small, -CELL_PX, -CELL_PX, W + 2 * CELL_PX, H + 2 * CELL_PX);
  g.filter = 'none';
  g.globalAlpha = 0.55;
  g.drawImage(small, 0, 0, W, H);
  g.globalAlpha = 1;

  // 2. Water edges: a darker rim where water meets land.
  g.strokeStyle = 'rgba(60,96,120,0.45)';
  g.lineWidth = 1.5;
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      const i = y * t.width + x;
      const water = (t.biome[i] as number) >= 5;
      if (!water) continue;
      const px = x * CELL_PX;
      const py = y * CELL_PX;
      if (x > 0 && (t.biome[i - 1] as number) < 5) line(g, px, py, px, py + CELL_PX);
      if (x < t.width - 1 && (t.biome[i + 1] as number) < 5)
        line(g, px + CELL_PX, py, px + CELL_PX, py + CELL_PX);
      if (y > 0 && (t.biome[i - t.width] as number) < 5) line(g, px, py, px + CELL_PX, py);
      if (y < t.height - 1 && (t.biome[i + t.width] as number) < 5)
        line(g, px, py + CELL_PX, px + CELL_PX, py + CELL_PX);
    }
  }

  // 3. Rocks get a few ink hatches.
  g.strokeStyle = 'rgba(70,62,56,0.35)';
  g.lineWidth = 0.8;
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      if (t.biome[y * t.width + x] !== 4 || hash2(x, y, 3) > 0.5) continue;
      const px = x * CELL_PX + hash2(x, y, 4) * CELL_PX;
      const py = y * CELL_PX + hash2(x, y, 5) * CELL_PX;
      line(g, px, py, px + 3, py - 2);
      line(g, px + 1.5, py + 1.5, px + 4.5, py - 0.5);
    }
  }

  // 4. Paper grain.
  const grain = g.getImageData(0, 0, W, H);
  for (let k = 0; k < grain.data.length; k += 4) {
    const n = (hash2(k & 1023, k >> 10, 7) - 0.5) * 10;
    grain.data[k] = (grain.data[k] as number) + n;
    grain.data[k + 1] = (grain.data[k + 1] as number) + n;
    grain.data[k + 2] = (grain.data[k + 2] as number) + n;
  }
  g.putImageData(grain, 0, 0);

  // 5. Player modifications: barriers, refuges, burrows.
  for (let y = 0; y < t.height; y++) {
    for (let x = 0; x < t.width; x++) {
      const i = y * t.width + x;
      const px = x * CELL_PX;
      const py = y * CELL_PX;
      const bar = t.barrier[i] as number;
      if (bar === 1) {
        g.fillStyle = 'rgba(70,96,50,0.85)';
        for (let k = 0; k < 3; k++)
          circle(g, px + 2 + k * 2, py + 4 + (hash2(x, y, k) - 0.5) * 3, 2.2);
      } else if (bar === 2) {
        g.fillStyle = 'rgba(90,70,50,0.75)';
        g.fillRect(px, py + 2, CELL_PX, CELL_PX - 4);
      }
      const marks = t.marks[i] as number;
      if (marks & 1) {
        g.fillStyle = 'rgba(120,110,100,0.9)';
        circle(g, px + 4, py + 4, 3);
      }
      if (marks & 2) {
        g.fillStyle = 'rgba(60,45,35,0.8)';
        circle(g, px + 4, py + 5, 1.8);
      }
    }
  }
  return c;
}

/** Vegetation overlay: grass wash, shrub dabs, tree canopies, fruit specks, algae tint. */
export function paintVegetation(
  v: VegetationGrid,
  terrain: TerrainGrid,
  canvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const W = v.width * CELL_PX;
  const H = v.height * CELL_PX;
  const c = canvas ?? document.createElement('canvas');
  if (c.width !== W || c.height !== H) {
    c.width = W;
    c.height = H;
  }
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, W, H);
  for (let y = 0; y < v.height; y++) {
    for (let x = 0; x < v.width; x++) {
      const i = y * v.width + x;
      const px = x * CELL_PX;
      const py = y * CELL_PX;
      const water = (terrain.biome[i] as number) >= 5;
      if (water) {
        const a = (v.algae[i] as number) / 255;
        if (a > 0.05) {
          g.fillStyle = `rgba(70,140,110,${a * 0.35})`;
          g.fillRect(px, py, CELL_PX, CELL_PX);
        }
        continue;
      }
      const grass = (v.grass[i] as number) / 255;
      if (grass > 0.03) {
        g.fillStyle = `rgba(110,150,60,${Math.min(0.55, grass * 0.6)})`;
        g.fillRect(px, py, CELL_PX, CELL_PX);
      } else {
        // Bare, overgrazed ground shows as dry ochre.
        g.fillStyle = 'rgba(196,170,120,0.25)';
        g.fillRect(px, py, CELL_PX, CELL_PX);
      }
      const shrub = (v.shrub[i] as number) / 255;
      if (shrub > 0.08 && hash2(x, y, 9) < 0.35 + shrub * 0.6) {
        // Irregular dabs that spill over cell borders, so no grid shows.
        g.fillStyle = `rgba(92,112,58,${Math.min(0.75, 0.2 + shrub * 0.8)})`;
        const n = 1 + Math.floor(hash2(x, y, 10) * (1 + shrub * 2));
        for (let k = 0; k < n; k++)
          circle(
            g,
            px + (hash2(x, y, 11 + k) * 1.6 - 0.3) * CELL_PX,
            py + (hash2(x, y, 21 + k) * 1.6 - 0.3) * CELL_PX,
            0.8 + hash2(x, y, 31 + k) * shrub * 2.6,
          );
      }
      const tree = (v.tree[i] as number) / 255;
      if (tree > 0.08 && hash2(x, y, 31) < 0.6) {
        const r = 2 + tree * 4.5;
        const cx = px + CELL_PX / 2 + (hash2(x, y, 41) - 0.5) * 4;
        const cy = py + CELL_PX / 2 + (hash2(x, y, 51) - 0.5) * 4;
        g.fillStyle = `rgba(52,92,58,${0.25 + tree * 0.55})`;
        circle(g, cx, cy, r);
        g.strokeStyle = 'rgba(30,50,34,0.35)';
        g.lineWidth = 0.7;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.stroke();
      }
      const fruit = (v.fruit[i] as number) / 255;
      if (fruit > 0.25 && hash2(x, y, 60) < fruit) {
        g.fillStyle = 'rgba(196,74,52,0.75)';
        const n = Math.min(3, Math.ceil(fruit * 3));
        for (let k = 0; k < n; k++)
          circle(g, px + 1 + hash2(x, y, 61 + k) * 6, py + 1 + hash2(x, y, 71 + k) * 6, 0.8);
      }
    }
  }
  return c;
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}
