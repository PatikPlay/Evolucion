import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { FaunaGrid, Frame, TerrainGrid, VegetationGrid } from '@linaje/protocol';
import { CreatureLayer } from './creatures';
import { FaunaLayer } from './fauna';
import { CELL_PX, paintTerrain, paintVegetation } from './terrain';
import { PAPER } from './palette';

/**
 * The 2D world view: terrain, vegetation, fauna and creatures under a camera
 * that pans, zooms and can follow an individual.
 */
export class WorldView {
  readonly app = new Application();
  readonly camera = new Container();
  readonly creatures = new CreatureLayer();
  readonly fauna = new FaunaLayer();
  private terrainSprite: Sprite | null = null;
  private vegSprite: Sprite | null = null;
  private vegCanvas: HTMLCanvasElement | null = null;
  private terrain: TerrainGrid | null = null;
  private night = new Graphics();
  private marker = new Graphics();
  private nightAlpha = 0;
  private targetNight = 0;
  private followId: number | null = null;
  private selectedId: number | null = null;
  private zoom = 1;
  private worldW = 96 * CELL_PX;
  private worldH = 96 * CELL_PX;
  private lastNow = performance.now();
  /** Frames per second, smoothed (for the benchmark and the debug overlay). */
  fps = 60;
  onPick: (id: number | null) => void = () => {};

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: host,
      background: PAPER,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
    });
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.camera);
    this.camera.addChild(this.fauna.container);
    this.camera.addChild(this.creatures.container);
    this.camera.addChild(this.marker);
    this.camera.addChild(this.night);
    this.night.eventMode = 'none';
    this.installInput();
    this.app.ticker.add(() => this.tick());
  }

  setTerrain(t: TerrainGrid): void {
    this.terrain = t;
    this.worldW = t.width * CELL_PX;
    this.worldH = t.height * CELL_PX;
    const tex = Texture.from(paintTerrain(t));
    if (this.terrainSprite) this.terrainSprite.destroy();
    this.terrainSprite = new Sprite(tex);
    this.camera.addChildAt(this.terrainSprite, 0);
    this.fauna.setTerrain(t);
    this.night.clear().rect(0, 0, this.worldW, this.worldH).fill({ color: 0x1b2340, alpha: 1 });
    this.night.alpha = 0;
    this.fit();
  }

  setVegetation(v: VegetationGrid): void {
    if (!this.terrain) return;
    this.vegCanvas = paintVegetation(v, this.terrain, this.vegCanvas ?? undefined);
    if (!this.vegSprite) {
      this.vegSprite = new Sprite(Texture.from(this.vegCanvas));
      this.camera.addChildAt(this.vegSprite, this.terrainSprite ? 1 : 0);
    } else {
      this.vegSprite.texture.source.update();
    }
  }

  setFauna(f: FaunaGrid): void {
    this.fauna.setGrid(f);
  }

  onFrame(f: Frame): void {
    this.creatures.onFrame(f, performance.now());
  }

  setNight(night: boolean): void {
    this.targetNight = night ? 0.32 : 0;
  }

  follow(id: number | null): void {
    this.followId = id;
  }

  select(id: number | null): void {
    this.selectedId = id;
  }

  /** Fits the whole parcel on screen. */
  fit(): void {
    const sw = this.app.screen.width;
    const sh = this.app.screen.height;
    this.zoom = Math.min(sw / this.worldW, sh / this.worldH) * 0.95;
    this.camera.scale.set(this.zoom);
    this.camera.x = (sw - this.worldW * this.zoom) / 2;
    this.camera.y = (sh - this.worldH * this.zoom) / 2;
  }

  /** Centres the camera on a world point (cells) at a zoom level. */
  lookAt(x: number, y: number, zoom = this.zoom): void {
    this.zoom = zoom;
    this.camera.scale.set(zoom);
    this.camera.x = this.app.screen.width / 2 - x * CELL_PX * zoom;
    this.camera.y = this.app.screen.height / 2 - y * CELL_PX * zoom;
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(100, now - this.lastNow);
    this.lastNow = now;
    if (dt > 0) this.fps = this.fps * 0.95 + (1000 / dt) * 0.05;
    this.creatures.update(now, dt);
    this.fauna.update(dt);
    this.nightAlpha += (this.targetNight - this.nightAlpha) * Math.min(1, dt / 600);
    this.night.alpha = this.nightAlpha;
    if (this.followId !== null) {
      const p = this.creatures.position(this.followId);
      if (p) this.lookAt(p.x, p.y);
      else this.followId = null;
    }
    this.marker.clear();
    if (this.selectedId !== null) {
      const p = this.creatures.position(this.selectedId);
      if (p) {
        const r = 1.4 * CELL_PX;
        this.marker
          .circle(p.x * CELL_PX, p.y * CELL_PX, r)
          .stroke({ width: 1.5 / this.zoom + 0.5, color: 0x2b2420, alpha: 0.9 });
      }
    }
  }

  private installInput(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;
    let dragging = false;
    let moved = 0;
    let lx = 0;
    let ly = 0;
    stage.on('pointerdown', (e) => {
      dragging = true;
      moved = 0;
      lx = e.global.x;
      ly = e.global.y;
    });
    stage.on('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.global.x - lx;
      const dy = e.global.y - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      lx = e.global.x;
      ly = e.global.y;
      if (moved > 4) {
        this.followId = null;
        this.camera.x += dx;
        this.camera.y += dy;
      }
    });
    const end = (e: { global: { x: number; y: number } }) => {
      if (!dragging) return;
      dragging = false;
      if (moved <= 4) {
        const wx = (e.global.x - this.camera.x) / this.zoom / CELL_PX;
        const wy = (e.global.y - this.camera.y) / this.zoom / CELL_PX;
        const id = this.creatures.pick(wx, wy, Math.max(1.2, 12 / (this.zoom * CELL_PX)));
        this.selectedId = id;
        this.onPick(id);
      }
    };
    stage.on('pointerup', end);
    stage.on('pointerupoutside', end);
    this.app.canvas.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        const factor = Math.exp(-ev.deltaY * 0.0015);
        const nz = Math.min(12, Math.max(0.3, this.zoom * factor));
        const rect = this.app.canvas.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;
        const wx = (mx - this.camera.x) / this.zoom;
        const wy = (my - this.camera.y) / this.zoom;
        this.zoom = nz;
        this.camera.scale.set(nz);
        this.camera.x = mx - wx * nz;
        this.camera.y = my - wy * nz;
      },
      { passive: false },
    );
    window.addEventListener('keydown', (ev) => {
      const step = 40;
      if (ev.key === 'ArrowLeft') this.camera.x += step;
      else if (ev.key === 'ArrowRight') this.camera.x -= step;
      else if (ev.key === 'ArrowUp') this.camera.y += step;
      else if (ev.key === 'ArrowDown') this.camera.y -= step;
      else if (ev.key === '0') this.fit();
    });
  }
}
