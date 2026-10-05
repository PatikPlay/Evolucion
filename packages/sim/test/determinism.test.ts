import { describe, expect, it } from 'vitest';
import { ParcelSim } from '../src/parcel';

function populated(seed: string): ParcelSim {
  const sim = new ParcelSim({ seed });
  sim.spawnFounders({ key: 'base', traits: {} }, 30, 0);
  return sim;
}

describe('determinism', () => {
  it('same seed and inputs give the same state hash after N ticks', () => {
    const a = populated('determinism');
    const b = populated('determinism');
    a.run(600);
    b.run(600);
    expect(a.org.liveCount).toBeGreaterThan(0);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('a different seed gives a different hash', () => {
    const a = populated('determinism');
    const b = populated('determinism-2');
    a.run(200);
    b.run(200);
    expect(a.stateHash()).not.toBe(b.stateHash());
  });

  it('stepping one by one equals running in a batch', () => {
    const a = populated('steps');
    const b = populated('steps');
    for (let i = 0; i < 300; i++) a.step();
    b.run(300);
    expect(a.tick).toBe(300);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('commands applied at the same tick give the same result', () => {
    const a = populated('commands');
    const b = populated('commands');
    a.run(100);
    b.run(100);
    for (const s of [a, b]) s.apply({ type: 'climate', tempAnomaly: -6 });
    a.run(200);
    b.run(200);
    expect(a.stateHash()).toBe(b.stateHash());
  });
});
