import { useEffect, useRef } from 'preact/hooks';
import { V } from '@linaje/protocol';
import { bodyPlan, paintCreature } from '../world/painter';
import { creatureColor, hexToCss } from '../world/palette';

/** A still drawing of a creature for the field card. */
export function CreaturePortrait({ def }: { def: readonly number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const out = ref.current;
    if (!out) return;
    const v = def.slice(3);
    const src = paintCreature(bodyPlan(v), 1);
    const g = out.getContext('2d') as CanvasRenderingContext2D;
    g.clearRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, 0, out.width, out.height);
    // Tint like the sprite does: multiply the colour, keep the drawing's alpha.
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = hexToCss(
      creatureColor(v[V.hue] ?? 8, v[V.lightness] ?? 8, v[V.conspicuous] ?? 4),
    );
    g.fillRect(0, 0, out.width, out.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(src, 0, 0, out.width, out.height);
    g.globalCompositeOperation = 'source-over';
  }, [def]);
  return <canvas ref={ref} width={160} height={160} class="portrait" />;
}
