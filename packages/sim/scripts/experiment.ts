/**
 * Runs one selection experiment over several seeds (tuning aid).
 *   tsx packages/sim/scripts/experiment.ts <a|b|c|d> <seedFrom> <seedTo>
 */
import {
  PREDATOR_SHARE,
  bottleneckExperiment,
  coldExperiment,
  driftExperiment,
  fastPredatorExperiment,
} from '../test/support/experiments';

const [kind = 'a', fromArg = '1', toArg = '4', shareArg, prodArg] = process.argv.slice(2);
for (let k = Number(fromArg); k <= Number(toArg); k++) {
  const seed = `exp-${k}`;
  const t0 = Date.now();
  let line: string;
  if (kind === 'a' || kind === 'b') {
    const r =
      kind === 'a'
        ? fastPredatorExperiment(
            seed,
            10,
            shareArg ? Number(shareArg) : undefined,
            prodArg ? { world: { targetProductivityPerCell: Number(prodArg) } } : undefined,
          )
        : coldExperiment(seed);
    line = `before=${r.before.mean.toFixed(3)}±${r.before.sd.toFixed(3)} treated=${r.treated.mean.toFixed(3)} control=${r.control.mean.toFixed(3)} effect=${r.effect.toFixed(2)}sd z=${r.z.toFixed(1)} years=${r.years} ${r.notes}`;
  } else if (kind === 'c') {
    const r = driftExperiment(seed);
    line = `deltas=${r.deltas.map((d) => d.toFixed(2)).join(',')} years=${r.years} n=${r.count}`;
  } else {
    const r = bottleneckExperiment(seed);
    line = `div ratio=${(r.diversityTreated / r.diversityControl).toFixed(2)} het ratio=${(r.heterozygosityTreated / r.heterozygosityControl).toFixed(2)} load ratio=${(r.loadTreated / r.loadControl).toFixed(2)} expr ratio=${(r.expressionTreated / r.expressionControl).toFixed(2)} (${r.expressionControl.toFixed(3)}) | affected before=${r.affectedBefore.toFixed(3)} treated=${r.affectedTreated.toFixed(3)} control=${r.affectedControl.toFixed(3)} | load ${r.loadTreated.toFixed(3)}/${r.loadControl.toFixed(3)} survivors=${r.survivors} n=${r.countTreated}`;
  }
  void PREDATOR_SHARE;
  console.log(`${kind} ${seed} ${line} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
