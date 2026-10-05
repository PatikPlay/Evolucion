import { describe, expect, it } from 'vitest';
import {
  FrameWriter,
  decodeFrame,
  decodeTerrain,
  decodeVegetation,
  encodeTerrain,
  encodeVegetation,
  findForbiddenKeys,
  parseClientMessage,
  validateServerMessage,
  quantise,
  dequantise,
  VISUAL_COUNT,
} from '../src/index';

describe('binary frames', () => {
  it('round-trips creature records with bounded precision', () => {
    const w = new FrameWriter(2, 1, 12345, 1);
    w.push(7, 10.5, 95.99, Math.PI / 2, 4, 0b101, 200);
    w.push(4000000000, 0, 0, -Math.PI / 2, 0, 0, 0);
    const f = decodeFrame(w.finish());
    expect(f.parcel).toBe(2);
    expect(f.stream).toBe(1);
    expect(f.tick).toBe(12345);
    expect(f.records).toHaveLength(2);
    const [a, b] = f.records;
    expect(a?.id).toBe(7);
    expect(a?.x).toBeCloseTo(10.5, 2);
    expect(a?.y).toBeCloseTo(95.99, 2);
    expect(a?.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(a?.anim).toBe(4);
    expect(a?.flags).toBe(0b101);
    expect(a?.growth).toBe(200);
    expect(b?.id).toBe(4000000000);
    expect(b?.heading).toBeCloseTo((3 * Math.PI) / 2, 1);
  });

  it('round-trips terrain and vegetation grids', () => {
    const n = 6;
    const t = {
      parcel: 1,
      width: 3,
      height: 2,
      biome: Uint8Array.from([0, 1, 2, 3, 4, 5]),
      elevation: new Uint8Array(n).fill(9),
      barrier: new Uint8Array(n),
      marks: new Uint8Array(n).fill(2),
    };
    expect(decodeTerrain(encodeTerrain(t))).toEqual(t);
    const v = {
      parcel: 0,
      tick: 99,
      width: 3,
      height: 2,
      grass: new Uint8Array(n).fill(1),
      shrub: new Uint8Array(n).fill(2),
      tree: new Uint8Array(n).fill(3),
      algae: new Uint8Array(n).fill(4),
      fruit: new Uint8Array(n).fill(5),
    };
    expect(decodeVegetation(encodeVegetation(v))).toEqual(v);
  });

  it('quantises to 16 levels', () => {
    expect(quantise(0)).toBe(0);
    expect(quantise(0.999)).toBe(15);
    expect(quantise(1.5)).toBe(15);
    expect(quantise(-1)).toBe(0);
    expect(dequantise(quantise(0.5))).toBeCloseTo(0.53, 2);
  });
});

describe('server message whitelist', () => {
  it('accepts allowed messages', () => {
    expect(() =>
      validateServerMessage({ t: 'clock', tick: 1, season: 0, year: 0, night: false, speed: 20 }),
    ).not.toThrow();
    expect(() =>
      validateServerMessage({
        t: 'creatures',
        defs: [[1, 2, 0, ...new Array(VISUAL_COUNT).fill(3)]],
      }),
    ).not.toThrow();
  });

  it('rejects unknown keys, unknown types and wrong shapes', () => {
    expect(() =>
      validateServerMessage({
        t: 'clock',
        tick: 1,
        season: 0,
        year: 0,
        night: false,
        speed: 20,
        energy: 3,
      }),
    ).toThrow(/not allowed/);
    expect(() => validateServerMessage({ t: 'genome', data: [] })).toThrow(/unknown/);
    expect(() =>
      validateServerMessage({ t: 'inspect', id: 1, found: true, species: 1, descriptors: [3] }),
    ).toThrow();
    expect(() =>
      validateServerMessage({
        t: 'creatures',
        defs: [[1, 2, 0, ...new Array(VISUAL_COUNT + 1).fill(3)]],
      }),
    ).toThrow();
  });

  it('allows debug messages only in debug mode', () => {
    expect(() => validateServerMessage({ t: 'debug', kind: 'x', data: { energy: 1 } })).toThrow();
    expect(() =>
      validateServerMessage({ t: 'debug', kind: 'x', data: { energy: 1 } }, { debug: true }),
    ).not.toThrow();
  });

  it('finds forbidden keys anywhere', () => {
    expect(findForbiddenKeys({ a: [{ b: { aggression: 1 } }] })).toEqual(['$.a[0].b.aggression']);
    expect(findForbiddenKeys({ t: 'clock' })).toEqual([]);
  });
});

describe('client messages', () => {
  it('parses valid intentions and rejects anything else', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'inspect', id: 5 }))).toEqual({
      t: 'inspect',
      id: 5,
    });
    expect(parseClientMessage(JSON.stringify({ t: 'inspect', id: 5, hack: 1 }))).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: 'setEnergy' }))).toBeNull();
  });
});
