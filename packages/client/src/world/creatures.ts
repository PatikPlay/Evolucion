import { Container, Sprite, Texture } from 'pixi.js';
import { ANIM_KEYS, FrameFlag, V, type Frame, type FrameRecord } from '@linaje/protocol';
import {
  bodyLength,
  bodyPlan,
  paintCreature,
  planKey,
  TEXTURE_SIZE,
  type BodyPlan,
} from './painter';
import { CELL_PX } from './terrain';
import { creatureColor, PLAYER_COLORS } from './palette';

const A = Object.fromEntries(ANIM_KEYS.map((k, i) => [k, i])) as Record<
  (typeof ANIM_KEYS)[number],
  number
>;

interface Entry {
  id: number;
  sprite: Sprite;
  ring: Sprite | null;
  def: readonly number[];
  frames: Texture[];
  /** World length in cells of an adult. */
  adultCells: number;
  baseScale: number;
  px: number;
  py: number;
  ph: number;
  nx: number;
  ny: number;
  nh: number;
  anim: number;
  flags: number;
  growth: number;
  phase: number;
  seen: number;
  /** Rendered position (cells). */
  x: number;
  y: number;
}

/**
 * Texture cache keyed by binned body plan; three walk frames each. Bounded:
 * once full, a new plan reuses the texture of the most similar cached plan.
 */
class TextureCache {
  private map = new Map<string, { frames: Texture[]; length: number; plan: BodyPlan }>();
  constructor(private readonly max = 400) {}

  get(v: readonly number[]): { frames: Texture[]; length: number } {
    const plan = bodyPlan(v);
    const key = planKey(plan);
    let t = this.map.get(key);
    if (t) return t;
    if (this.map.size >= this.max) return this.nearest(plan);
    const frames = ([0, 1, 2] as const).map((f) => Texture.from(paintCreature(plan, f)));
    t = { frames, length: bodyLength(plan), plan };
    this.map.set(key, t);
    return t;
  }

  private nearest(p: BodyPlan): { frames: Texture[]; length: number } {
    let best: { frames: Texture[]; length: number } | null = null;
    let bd = Infinity;
    for (const t of this.map.values()) {
      let d = 0;
      for (const k of Object.keys(p) as (keyof BodyPlan)[]) d += Math.abs(p[k] - t.plan[k]);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best as { frames: Texture[]; length: number };
  }

  get size(): number {
    return this.map.size;
  }
}

let RING: Texture | null = null;
/** Shared ellipse outline used for every owner ring (tinted per player). */
function ringTexture(): Texture {
  if (RING) return RING;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(32, 32, 29, 29, 0, 0, Math.PI * 2);
  g.stroke();
  RING = Texture.from(c);
  return RING;
}

/** World length (cells) of an adult from its size level (length ∝ mass^1/3). */
function adultLength(sizeLevel: number): number {
  const mass = Math.exp(Math.log(0.4) + ((sizeLevel + 0.5) / 16) * Math.log(100));
  return 0.75 * Math.cbrt(mass / 0.4) * 0.62;
}

/** Draws creatures from frames, interpolating between consecutive frames. */
export class CreatureLayer {
  readonly container = new Container();
  private entries = new Map<number, Entry>();
  private defs = new Map<number, readonly number[]>();
  private cache = new TextureCache();
  private frameAt = 0;
  private frameInterval = 50;
  private lastTick = -1;
  showRings = true;

  setDefs(defs: number[][]): void {
    for (const d of defs) this.defs.set(d[0] as number, d);
  }

  get textureCount(): number {
    return this.cache.size;
  }

  get count(): number {
    return this.entries.size;
  }

  onFrame(f: Frame, now: number): void {
    if (this.lastTick >= 0 && f.tick > this.lastTick) {
      const dt = now - this.frameAt;
      // Smooth estimate of the time between frames.
      this.frameInterval = Math.min(500, Math.max(16, this.frameInterval * 0.8 + dt * 0.2));
    }
    this.frameAt = now;
    this.lastTick = f.tick;
    const seen = f.tick;
    for (const r of f.records) this.upsert(r, seen);
    for (const [id, e] of this.entries) {
      if (e.seen !== seen) {
        e.sprite.destroy();
        e.ring?.destroy();
        this.entries.delete(id);
        this.defs.delete(id);
      }
    }
  }

  private upsert(r: FrameRecord, seen: number): void {
    let e = this.entries.get(r.id);
    if (!e) {
      const def = this.defs.get(r.id);
      if (!def) return;
      const v = def.slice(3);
      const tex = this.cache.get(v);
      const sprite = new Sprite(tex.frames[0]);
      sprite.anchor.set(0.5);
      sprite.tint = creatureColor(v[V.hue] ?? 8, v[V.lightness] ?? 8, v[V.conspicuous] ?? 4);
      const adultCells = adultLength(v[V.size] ?? 8);
      const baseScale = (adultCells * CELL_PX) / ((tex.length / TEXTURE_SIZE) * 2 * TEXTURE_SIZE);
      const owner = def[2] as number;
      let ring: Sprite | null = null;
      if (owner < PLAYER_COLORS.length) {
        ring = new Sprite(ringTexture());
        ring.anchor.set(0.5);
        ring.tint = PLAYER_COLORS[owner] ?? 0xffffff;
        ring.alpha = 0.6;
        ring.width = adultCells * CELL_PX * 1.3;
        ring.height = adultCells * CELL_PX * 0.85;
        this.container.addChild(ring);
      }
      this.container.addChild(sprite);
      e = {
        id: r.id,
        sprite,
        ring,
        def,
        frames: tex.frames,
        adultCells,
        baseScale,
        px: r.x,
        py: r.y,
        ph: r.heading,
        nx: r.x,
        ny: r.y,
        nh: r.heading,
        anim: r.anim,
        flags: r.flags,
        growth: r.growth,
        phase: Math.random() * 6,
        seen,
        x: r.x,
        y: r.y,
      };
      this.entries.set(r.id, e);
    } else {
      e.px = e.x;
      e.py = e.y;
      e.ph = e.sprite.rotation;
      e.nx = r.x;
      e.ny = r.y;
      e.nh = r.heading;
    }
    e.anim = r.anim;
    e.flags = r.flags;
    e.growth = r.growth;
    e.seen = seen;
  }

  /** Milliseconds spent in the last update (CPU side), smoothed. */
  updateMs = 0;

  /** Positions and animates every sprite for the current display time. */
  update(now: number, dtMs: number): void {
    const t0 = performance.now();
    const t = Math.min(1, Math.max(0, (now - this.frameAt) / this.frameInterval));
    for (const e of this.entries.values()) {
      const x = e.px + (e.nx - e.px) * t;
      const y = e.py + (e.ny - e.py) * t;
      const moved = Math.hypot(e.nx - e.px, e.ny - e.py);
      e.x = x;
      e.y = y;
      const s = e.sprite;
      s.x = x * CELL_PX;
      s.y = y * CELL_PX;
      let dh = e.nh - e.ph;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      s.rotation = moved > 0.002 ? e.ph + dh * Math.min(1, t * 2) : s.rotation;
      // Walk cycle speed follows the distance covered per frame.
      const speed = moved / Math.max(1, this.frameInterval / 50);
      e.phase += dtMs * 0.004 + speed * dtMs * 0.12;
      const a = e.anim;
      const flags = e.flags;
      const growth = Math.max(0.25, e.growth / 200);
      let scale = e.baseScale * growth;
      let sx = 1;
      let sy = 1;
      let alpha = 1;
      let frame = 0;
      if (speed > 0.01)
        frame = Math.floor(e.phase) % 4 === 1 ? 1 : Math.floor(e.phase) % 4 === 3 ? 2 : 0;
      if (a === A.graze || a === A.scavenge || a === A.forage)
        sx = 1 + Math.sin(e.phase * 2) * 0.04;
      if (a === A.sleep || a === A.rest || a === A.hibernate) {
        sy = 0.92 + Math.sin(e.phase * 0.5) * 0.02;
        frame = 0;
      }
      if (a === A.flee || a === A.hunt) sx = 1.06;
      if (a === A.fight || a === A.defend) s.rotation += Math.sin(e.phase * 6) * 0.08;
      if (flags & FrameFlag.Pregnant) sy *= 1.12;
      if (flags & FrameFlag.Thin) sy *= 0.88;
      if (flags & FrameFlag.Hidden) alpha = 0.5;
      if (flags & FrameFlag.Burrowed) alpha = 0.2;
      if (flags & FrameFlag.Swimming) {
        alpha *= 0.8;
        frame = 0;
      }
      if (flags & FrameFlag.Climbing) scale *= 1.05;
      if (flags & FrameFlag.Limping) s.y += Math.abs(Math.sin(e.phase * 2)) * 0.6;
      if (a === A.hibernate) alpha *= 0.7;
      s.texture = e.frames[frame] as Texture;
      s.scale.set(scale * sx, scale * sy);
      s.alpha = alpha;
      if (e.ring) {
        e.ring.visible = this.showRings;
        e.ring.x = s.x;
        e.ring.y = s.y;
        e.ring.rotation = s.rotation;
        e.ring.width = e.adultCells * CELL_PX * 1.3 * growth;
        e.ring.height = e.adultCells * CELL_PX * 0.85 * growth;
      }
    }
    this.updateMs = this.updateMs * 0.9 + (performance.now() - t0) * 0.1;
  }

  /** Nearest creature to a world point (cells) within `radius` cells. */
  pick(x: number, y: number, radius: number): number | null {
    let best: number | null = null;
    let bd = radius * radius;
    for (const e of this.entries.values()) {
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e.id;
      }
    }
    return best;
  }

  allPositions(): { x: number; y: number }[] {
    return [...this.entries.values()].map((e) => ({ x: e.x, y: e.y }));
  }

  /** Mean of each visual level over the creatures on screen (tests and debug). */
  visualMeans(): number[] {
    const sums: number[] = [];
    let n = 0;
    for (const e of this.entries.values()) {
      const v = e.def.slice(3);
      v.forEach((x, k) => (sums[k] = (sums[k] ?? 0) + x));
      n++;
    }
    return sums.map((s) => s / Math.max(1, n));
  }

  position(id: number): { x: number; y: number } | null {
    const e = this.entries.get(id);
    return e ? { x: e.x, y: e.y } : null;
  }

  defOf(id: number): readonly number[] | null {
    return this.defs.get(id) ?? null;
  }

  animOf(id: number): number | null {
    return this.entries.get(id)?.anim ?? null;
  }
}
