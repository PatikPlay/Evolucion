import { VISUAL_COUNT, FrameWriter, decodeFrame } from '@linaje/protocol';
import { WorldView } from './world/stage';

/**
 * Client benchmark: N synthetic creatures wandering over a parcel, rendered
 * exactly like real ones. Reports the average fps on `document.body.dataset.fps`.
 */
export async function runBench(root: HTMLElement, n: number): Promise<void> {
  root.innerHTML =
    '<div class="world" style="position:absolute;inset:0"></div><div class="clock" id="bench-out">…</div>';
  const world = new WorldView();
  await world.init(root.firstElementChild as HTMLElement);
  const size = 96;
  const biome = new Uint8Array(size * size);
  const elevation = new Uint8Array(size * size);
  for (let i = 0; i < biome.length; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    biome[i] = x + y < 20 ? 6 : (x * 7 + y * 3) % 23 < 9 ? 1 : 0;
    elevation[i] = (x + y) % 255;
  }
  world.setTerrain({
    parcel: 0,
    width: size,
    height: size,
    biome,
    elevation,
    barrier: new Uint8Array(size * size),
    marks: new Uint8Array(size * size),
  });
  // Realistic variety: six species, individuals varying around their species' look.
  const defs: number[][] = [];
  const pos: { x: number; y: number; h: number }[] = [];
  const species = Array.from({ length: 6 }, () =>
    new Array<number>(VISUAL_COUNT).fill(0).map(() => 2 + Math.floor(Math.random() * 12)),
  );
  for (let k = 0; k < n; k++) {
    const sp = k % species.length;
    const v = (species[sp] as number[]).map((x) =>
      Math.max(0, Math.min(15, x + Math.round((Math.random() - 0.5) * 3))),
    );
    v[3] = 2;
    defs.push([k + 1, 1 + sp, sp, ...v]);
    pos.push({ x: 10 + Math.random() * 76, y: 10 + Math.random() * 76, h: Math.random() * 6.28 });
  }
  world.creatures.setDefs(defs);
  let tick = 0;
  const step = () => {
    const w = new FrameWriter(0, 0, tick++, n);
    for (let k = 0; k < n; k++) {
      const p = pos[k] as { x: number; y: number; h: number };
      p.h += (Math.random() - 0.5) * 0.4;
      p.x = Math.min(95, Math.max(1, p.x + Math.cos(p.h) * 0.12));
      p.y = Math.min(95, Math.max(1, p.y + Math.sin(p.h) * 0.12));
      w.push(k + 1, p.x, p.y, p.h, 1, 0, 200);
    }
    world.onFrame(decodeFrame(w.finish()));
  };
  step();
  setInterval(step, 50);
  // Measure after a warm-up.
  await new Promise((r) => setTimeout(r, 1500));
  let frames = 0;
  const t0 = performance.now();
  const count = () => {
    frames++;
    if (performance.now() - t0 < 5000) requestAnimationFrame(count);
    else {
      const fps = (frames * 1000) / (performance.now() - t0);
      document.body.dataset.fps = fps.toFixed(1);
      document.body.dataset.updateMs = world.creatures.updateMs.toFixed(2);
      (document.getElementById('bench-out') as HTMLElement).textContent =
        `${n} criaturas: ${fps.toFixed(1)} fps · CPU por fotograma ${world.creatures.updateMs.toFixed(2)} ms`;
    }
  };
  requestAnimationFrame(count);
}
