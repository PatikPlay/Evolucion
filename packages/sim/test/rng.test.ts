import { describe, expect, it } from 'vitest';
import { Rng, cyrb128 } from '../src/rng';

describe('Rng', () => {
  it('is reproducible for the same key', () => {
    const a = new Rng('seed/x');
    const b = new Rng('seed/x');
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('diverges for different keys', () => {
    const a = new Rng('seed/x');
    const b = new Rng('seed/y');
    let same = 0;
    for (let i = 0; i < 1000; i++) if (a.nextU32() === b.nextU32()) same++;
    expect(same).toBeLessThan(3);
  });

  it('forks independent streams that do not depend on parent position', () => {
    const p1 = new Rng('root');
    const p2 = new Rng('root');
    p2.nextU32();
    p2.nextU32();
    expect(p1.fork('genetics').nextU32()).toBe(p2.fork('genetics').nextU32());
    expect(p1.fork('genetics').nextU32()).not.toBe(p1.fork('behavior').nextU32());
  });

  it('produces uniform floats in [0,1) with the right mean and variance', () => {
    const r = new Rng('uniform');
    const n = 200_000;
    let sum = 0;
    let sum2 = 0;
    let min = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      const v = r.float();
      sum += v;
      sum2 += v * v;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    const mean = sum / n;
    const variance = sum2 / n - mean * mean;
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    expect(mean).toBeCloseTo(0.5, 2);
    expect(variance).toBeCloseTo(1 / 12, 2);
  });

  it('produces standard normals', () => {
    const r = new Rng('normal');
    const n = 200_000;
    let sum = 0;
    let sum2 = 0;
    for (let i = 0; i < n; i++) {
      const v = r.normal();
      sum += v;
      sum2 += v * v;
    }
    const mean = sum / n;
    expect(mean).toBeCloseTo(0, 1);
    expect(sum2 / n - mean * mean).toBeCloseTo(1, 1);
  });

  it('int stays in range and covers it', () => {
    const r = new Rng('int');
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 70_000; i++) {
      const v = r.int(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    for (const c of counts) expect(c).toBeGreaterThan(9000);
  });

  it('weightedIndex respects weights', () => {
    const r = new Rng('weights');
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) counts[r.weightedIndex([1, 0, 3])]! += 1;
    expect(counts[1]).toBe(0);
    expect(counts[2]! / counts[0]!).toBeGreaterThan(2.6);
    expect(counts[2]! / counts[0]!).toBeLessThan(3.4);
    expect(r.weightedIndex([0, 0])).toBe(-1);
  });

  it('round-trips its state', () => {
    const r = new Rng('state');
    r.nextU32();
    const s = r.getState();
    const a = [r.nextU32(), r.nextU32()];
    r.setState(s);
    expect([r.nextU32(), r.nextU32()]).toEqual(a);
    const copy = new Rng('other', s);
    copy.setState(s);
    expect(copy.nextU32()).toBe(a[0]);
  });

  it('cyrb128 is stable', () => {
    expect(cyrb128('linaje')).toEqual(cyrb128('linaje'));
    expect(cyrb128('linaje')).not.toEqual(cyrb128('linajf'));
  });
});
