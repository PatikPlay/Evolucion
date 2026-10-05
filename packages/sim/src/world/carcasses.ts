/** Carcasses left by deaths; scavengers and predators eat the meat. */
export class Carcasses {
  x: Float32Array;
  y: Float32Array;
  meat: Float32Array;
  /** Toxin concentration inherited from the dead organism. */
  toxin: Float32Array;
  lineage: Uint8Array;
  /** Hue of the dead animal: predators learn to avoid toxic-looking prey. */
  hue: Float32Array;
  count = 0;
  private capacity: number;

  constructor(capacity = 256) {
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.meat = new Float32Array(capacity);
    this.toxin = new Float32Array(capacity);
    this.lineage = new Uint8Array(capacity);
    this.hue = new Float32Array(capacity);
  }

  add(x: number, y: number, meat: number, toxin: number, lineage: number, hue: number): number {
    if (meat <= 0.05) return -1;
    if (this.count >= this.capacity) this.grow();
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.meat[i] = meat;
    this.toxin[i] = toxin;
    this.lineage[i] = lineage;
    this.hue[i] = hue;
    return i;
  }

  private grow(): void {
    const cap = this.capacity * 2;
    const nx = new Float32Array(cap);
    nx.set(this.x);
    this.x = nx;
    const ny = new Float32Array(cap);
    ny.set(this.y);
    this.y = ny;
    const nm = new Float32Array(cap);
    nm.set(this.meat);
    this.meat = nm;
    const nt = new Float32Array(cap);
    nt.set(this.toxin);
    this.toxin = nt;
    const nl = new Uint8Array(cap);
    nl.set(this.lineage);
    this.lineage = nl;
    const nh = new Float32Array(cap);
    nh.set(this.hue);
    this.hue = nh;
    this.capacity = cap;
  }

  /** Decays meat and compacts the list (stable order keeps determinism). */
  update(decay: number): void {
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const m = (this.meat[i] as number) * (1 - decay) - 0.002;
      if (m <= 0.05) continue;
      this.x[w] = this.x[i] as number;
      this.y[w] = this.y[i] as number;
      this.meat[w] = m;
      this.toxin[w] = this.toxin[i] as number;
      this.lineage[w] = this.lineage[i] as number;
      this.hue[w] = this.hue[i] as number;
      w++;
    }
    this.count = w;
  }

  /** Index of the nearest carcass within `radius`, or -1. */
  nearest(x: number, y: number, radius: number): number {
    let best = -1;
    let bd = radius * radius;
    for (let i = 0; i < this.count; i++) {
      const dx = (this.x[i] as number) - x;
      const dy = (this.y[i] as number) - y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  take(i: number, amount: number): number {
    const avail = this.meat[i] as number;
    const got = Math.min(avail, amount);
    this.meat[i] = avail - got;
    return got;
  }
}
