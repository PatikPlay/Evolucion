import { describe, expect, it } from 'vitest';
import { ParcelSim, TRAITS } from '@linaje/sim';
import { FORBIDDEN_KEYS, VISUAL_COUNT, decodeFrame, validateServerMessage } from '@linaje/protocol';
import { creatureDef, describe as describeCreature, encodeFrame } from '../src/index';

describe('hidden-information boundary', () => {
  it('every hidden trait name is a forbidden key; visible ones are drawable', () => {
    for (const t of TRAITS) {
      if (t.visible) expect(FORBIDDEN_KEYS).not.toContain(t.key);
      else expect(FORBIDDEN_KEYS).toContain(t.key);
    }
  });

  it('creature definitions carry only quantised visible parameters', () => {
    const sim = new ParcelSim({ seed: 'boundary' });
    sim.spawnFounders({ key: 'base', traits: {} }, 20, 0);
    sim.run(50);
    const defs = sim.living().map((i) => creatureDef(sim, i));
    for (const d of defs) {
      expect(d).toHaveLength(3 + VISUAL_COUNT);
      for (const v of d.slice(3)) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(16);
      }
    }
    expect(() => validateServerMessage({ t: 'creatures', defs })).not.toThrow();
  });

  it('frames and field cards contain no numbers about hidden state', () => {
    const sim = new ParcelSim({ seed: 'boundary-2' });
    sim.spawnFounders({ key: 'base', traits: {} }, 20, 0);
    sim.run(100);
    const f = decodeFrame(encodeFrame(sim, 0, 0));
    expect(f.records.length).toBe(sim.org.liveCount);
    const i = sim.living()[0] as number;
    const card = {
      t: 'inspect',
      id: sim.org.id[i],
      found: true,
      species: sim.org.species[i],
      descriptors: describeCreature(sim, i),
    };
    expect(() => validateServerMessage(card)).not.toThrow();
    for (const d of card.descriptors) expect(d).toMatch(/^[a-z]+\.[A-Za-z]+$/);
  });
});
