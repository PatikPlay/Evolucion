/**
 * Headless runner: `pnpm sim:run --seed abc --ticks 4000`.
 * Prints the final state hash and timing. Grows into the full headless driver in H1.
 */
import { parseArgs } from 'node:util';
import { ParcelSim, hashToHex } from '../src/index';

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: 'linaje' },
    ticks: { type: 'string', default: '4000' },
  },
});

const ticks = Number(values.ticks);
const sim = new ParcelSim({ seed: values.seed ?? 'linaje' });
const t0 = process.hrtime.bigint();
sim.run(ticks);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(
  `seed=${values.seed} ticks=${ticks} hash=${hashToHex(sim.stateHash())} time=${ms.toFixed(1)}ms`,
);
