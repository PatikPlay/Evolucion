/**
 * Uniform bucket grid rebuilt every tick with a counting sort (O(n), no
 * allocation). Queries write slot indices into a caller-provided buffer.
 */
export class SpatialGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  private readonly start: Int32Array;
  private items: Int32Array;
  private readonly counts: Int32Array;

  constructor(width: number, height: number, cellSize = 4) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.start = new Int32Array(this.cols * this.rows + 1);
    this.counts = new Int32Array(this.cols * this.rows);
    this.items = new Int32Array(1024);
  }

  private bucket(x: number, y: number): number {
    let cx = Math.floor(x / this.cellSize);
    let cy = Math.floor(y / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  rebuild(alive: Uint8Array, xs: Float32Array, ys: Float32Array, high: number): void {
    if (this.items.length < high)
      this.items = new Int32Array(Math.max(high, this.items.length * 2));
    const counts = this.counts;
    counts.fill(0);
    for (let i = 0; i < high; i++) {
      if (!alive[i]) continue;
      counts[this.bucket(xs[i] as number, ys[i] as number)]! += 1;
    }
    const start = this.start;
    let acc = 0;
    for (let b = 0; b < counts.length; b++) {
      start[b] = acc;
      acc += counts[b] as number;
      counts[b] = start[b] as number;
    }
    start[counts.length] = acc;
    for (let i = 0; i < high; i++) {
      if (!alive[i]) continue;
      const b = this.bucket(xs[i] as number, ys[i] as number);
      this.items[counts[b]!++] = i;
    }
  }

  /**
   * Collects slots within `radius` of (x, y) into `out` (up to out.length),
   * nearest buckets first is not guaranteed. Returns the number written.
   */
  query(
    x: number,
    y: number,
    radius: number,
    xs: Float32Array,
    ys: Float32Array,
    out: Int32Array,
    exclude = -1,
  ): number {
    const r2 = radius * radius;
    const cs = this.cellSize;
    const x0 = Math.max(0, Math.floor((x - radius) / cs));
    const x1 = Math.min(this.cols - 1, Math.floor((x + radius) / cs));
    const y0 = Math.max(0, Math.floor((y - radius) / cs));
    const y1 = Math.min(this.rows - 1, Math.floor((y + radius) / cs));
    let n = 0;
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        const b = by * this.cols + bx;
        const end = this.start[b + 1] as number;
        for (let k = this.start[b] as number; k < end; k++) {
          const j = this.items[k] as number;
          if (j === exclude) continue;
          const dx = (xs[j] as number) - x;
          const dy = (ys[j] as number) - y;
          if (dx * dx + dy * dy <= r2) {
            out[n++] = j;
            if (n >= out.length) return n;
          }
        }
      }
    }
    return n;
  }

  /** Number of organisms in the bucket containing (x, y) — a cheap local density. */
  bucketCount(x: number, y: number): number {
    const b = this.bucket(x, y);
    return (this.start[b + 1] as number) - (this.start[b] as number);
  }
}
