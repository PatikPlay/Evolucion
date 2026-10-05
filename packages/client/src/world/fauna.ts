import { Container, Sprite, Texture } from 'pixi.js';
import type { FaunaGrid, TerrainGrid } from '@linaje/protocol';
import { CELL_PX } from './terrain';

interface Mote {
  sprite: Sprite;
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

/**
 * Ambient background fauna: insects, small herbivores and fish drawn as
 * short-lived motes wherever the density fields say they are abundant.
 */
export class FaunaLayer {
  readonly container = new Container();
  private motes: Mote[] = [];
  private grid: FaunaGrid | null = null;
  private terrain: TerrainGrid | null = null;
  private textures: Texture[] = [];

  constructor(private readonly max = 260) {
    this.textures = [Texture.WHITE, Texture.WHITE, Texture.WHITE];
  }

  setTerrain(t: TerrainGrid): void {
    this.terrain = t;
  }

  setGrid(g: FaunaGrid): void {
    this.grid = g;
  }

  update(dtMs: number): void {
    const g = this.grid;
    if (!g) return;
    // Respawn motes proportionally to density.
    while (this.motes.length < this.max) {
      const kind = Math.floor(Math.random() * 3);
      const layer = kind === 0 ? g.insects : kind === 1 ? g.small : g.fish;
      const b = Math.floor(Math.random() * layer.length);
      const dens = (layer[b] as number) / 255;
      if (Math.random() > dens) {
        if (Math.random() < 0.5) break;
        continue;
      }
      const bx = (b % g.bw) * g.blockSize;
      const by = Math.floor(b / g.bw) * g.blockSize;
      const x = bx + Math.random() * g.blockSize;
      const y = by + Math.random() * g.blockSize;
      if (this.terrain) {
        const water =
          (this.terrain.biome[Math.floor(y) * this.terrain.width + Math.floor(x)] as number) >= 5;
        if ((kind === 2) !== water) continue;
      }
      const s = new Sprite(this.textures[kind]);
      s.anchor.set(0.5);
      if (kind === 0) {
        s.width = 1.2;
        s.height = 1.2;
        s.tint = 0x3a3428;
      } else if (kind === 1) {
        s.width = 2.4;
        s.height = 1.6;
        s.tint = 0x8a6a48;
      } else {
        s.width = 3;
        s.height = 1.2;
        s.tint = 0xc8d4dc;
      }
      s.alpha = 0;
      this.container.addChild(s);
      const speed = kind === 0 ? 0.02 : kind === 1 ? 0.008 : 0.012;
      const a = Math.random() * Math.PI * 2;
      this.motes.push({
        sprite: s,
        kind,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 2000 + Math.random() * 4000,
      });
    }
    for (let k = this.motes.length - 1; k >= 0; k--) {
      const m = this.motes[k] as Mote;
      m.life -= dtMs;
      if (m.kind === 0) {
        m.vx += (Math.random() - 0.5) * 0.004;
        m.vy += (Math.random() - 0.5) * 0.004;
      }
      m.x += m.vx * dtMs * 0.06;
      m.y += m.vy * dtMs * 0.06;
      m.sprite.x = m.x * CELL_PX;
      m.sprite.y = m.y * CELL_PX;
      m.sprite.rotation = Math.atan2(m.vy, m.vx);
      const fade = Math.min(1, m.life / 600);
      m.sprite.alpha = Math.min(0.85, m.sprite.alpha + dtMs * 0.002) * fade;
      if (m.life <= 0) {
        m.sprite.destroy();
        this.motes.splice(k, 1);
      }
    }
  }
}
