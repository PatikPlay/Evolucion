import { describe, expect, it } from 'vitest';
import { ParcelSim } from '../src/parcel';

describe('determinism', () => {
  it('same seed and inputs give the same state hash after N ticks', () => {
    const a = new ParcelSim({ seed: 'determinism' });
    const b = new ParcelSim({ seed: 'determinism' });
    a.run(500);
    b.run(500);
    expect(a.stateHash()).toBe(b.stateHash());
  });

  it('a different seed gives a different hash', () => {
    const a = new ParcelSim({ seed: 'determinism' });
    const b = new ParcelSim({ seed: 'determinism-2' });
    a.run(500);
    b.run(500);
    expect(a.stateHash()).not.toBe(b.stateHash());
  });

  it('stepping one by one equals running in a batch', () => {
    const a = new ParcelSim({ seed: 'steps' });
    const b = new ParcelSim({ seed: 'steps' });
    for (let i = 0; i < 300; i++) a.step();
    b.run(300);
    expect(a.tick).toBe(300);
    expect(a.stateHash()).toBe(b.stateHash());
  });
});
