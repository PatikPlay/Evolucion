import { V } from '@linaje/protocol';

/**
 * Procedural creature drawing. Bodies are painted in light neutral tones and
 * coloured with a sprite tint, so individuals that share a body plan share a
 * texture. Creatures face +x; three frames give a walk cycle.
 */

export const TEXTURE_SIZE = 128;
/** Logical drawing units per texture (drawn at 2× for crisp zoom). */
const RES = 2;
const HALF = TEXTURE_SIZE / RES / 2;

export interface BodyPlan {
  elong: number;
  legLen: number;
  legPairs: number;
  legStr: number;
  prehensile: number;
  fins: number;
  membranes: number;
  armor: number;
  spines: number;
  tail: number;
  fur: number;
  spots: number;
  stripes: number;
  eyes: number;
}

/** Coarser bins for texture sharing. */
const bin = (v: number, bins: number) => Math.min(bins - 1, Math.floor(((v + 0.5) / 16) * bins));

/** Body plan (texture key inputs) from quantised visual levels, binned for sharing. */
export function bodyPlan(v: readonly number[]): BodyPlan {
  return {
    elong: bin(v[V.elongation] ?? 8, 6),
    legLen: bin(v[V.legLength] ?? 8, 6),
    legPairs: v[V.legCount] ?? 2,
    legStr: bin(v[V.legStrength] ?? 8, 4),
    prehensile: bin(v[V.prehensile] ?? 0, 3),
    fins: bin(v[V.fins] ?? 0, 4),
    membranes: bin(v[V.membranes] ?? 0, 4),
    armor: bin(v[V.armor] ?? 0, 4),
    spines: bin(v[V.spines] ?? 0, 4),
    tail: bin(v[V.tail] ?? 8, 5),
    fur: bin(v[V.fur] ?? 0, 4),
    spots: bin(v[V.spots] ?? 0, 4),
    stripes: bin(v[V.stripes] ?? 0, 4),
    eyes: bin(v[V.eyes] ?? 8, 4),
  };
}

export function planKey(p: BodyPlan): string {
  return [
    p.elong,
    p.legLen,
    p.legPairs,
    p.legStr,
    p.prehensile,
    p.fins,
    p.membranes,
    p.armor,
    p.spines,
    p.tail,
    p.fur,
    p.spots,
    p.stripes,
    p.eyes,
  ].join('.');
}

/** Body length in logical units for a plan (used to scale sprites to world size). */
export function bodyLength(p: BodyPlan): number {
  return 22 + 14 * (p.elong / 5);
}

/** Deterministic pseudo-random sequence from a string key (pattern placement). */
function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const INK = 'rgba(43,36,32,0.92)';
const INK_SOFT = 'rgba(43,36,32,0.45)';

/** Paints one walk frame (0 neutral, 1 and 2 opposite strides). */
export function paintCreature(
  p: BodyPlan,
  frame: 0 | 1 | 2,
  canvas?: HTMLCanvasElement,
): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = TEXTURE_SIZE;
  c.height = TEXTURE_SIZE;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  g.save();
  g.scale(RES, RES);
  g.translate(HALF, HALF);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const elong = p.elong / 5;
  const BL = bodyLength(p);
  const BW = 15 - 6 * elong;
  const legless = p.legPairs === 0;
  const stride = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const rnd = seeded(planKey(p));
  const furLen = p.fur * 1.1;

  // Body is centred slightly behind the origin so the head leads.
  const bx = -BL * 0.1;
  const rx = BL / 2;
  const ry = BW / 2;

  // --- Tail ---
  const tailLen = 3 + p.tail * 5.5;
  if (tailLen > 3) {
    const tx0 = bx - rx + 1;
    const sway = legless ? stride * 3 : stride * 1.5;
    g.strokeStyle = INK;
    g.lineWidth = Math.max(1.2, ry * 0.5);
    g.beginPath();
    g.moveTo(tx0, 0);
    g.quadraticCurveTo(tx0 - tailLen * 0.5, sway * 1.5, tx0 - tailLen, sway * 2.5);
    g.stroke();
    g.strokeStyle = '#f4f1ea';
    g.lineWidth = Math.max(0.6, ry * 0.5 - 1.2);
    g.stroke();
    if (p.prehensile >= 2) {
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(tx0 - tailLen - 1, sway * 2.5 + 1.5, 1.8, 0, Math.PI * 1.4);
      g.stroke();
    }
  }

  // --- Membranes (gliding skin between legs) ---
  if (p.membranes >= 2 && !legless) {
    g.fillStyle = `rgba(210,200,185,${0.35 + 0.15 * p.membranes})`;
    g.strokeStyle = INK_SOFT;
    g.lineWidth = 0.8;
    const span = ry + 4 + p.membranes * 2.5;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(bx + rx * 0.55, side * ry * 0.6);
      g.lineTo(bx + rx * 0.4, side * span);
      g.quadraticCurveTo(bx, side * (span + 2), bx - rx * 0.45, side * span);
      g.lineTo(bx - rx * 0.55, side * ry * 0.6);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  // --- Legs (top view: they stick out of the flanks) ---
  if (!legless) {
    const legLen = 2.5 + p.legLen * 2.1;
    const legW = 1.2 + p.legStr * 0.8;
    const pairs = p.legPairs;
    for (let k = 0; k < pairs; k++) {
      const t = pairs === 1 ? 0 : k / (pairs - 1);
      const ax = bx + rx * (0.55 - 1.1 * t);
      const phase = (k % 2 === 0 ? 1 : -1) * stride;
      for (const side of [-1, 1]) {
        const swing = phase * side * 0.55;
        const ang = side * (Math.PI / 2) + swing;
        const kneeX = ax + Math.cos(ang) * legLen * 0.55 + phase * 1.5;
        const kneeY = side * ry * 0.7 + Math.sin(ang) * legLen * 0.55;
        const footX = kneeX + Math.cos(ang - side * 0.5) * legLen * 0.5;
        const footY = kneeY + Math.sin(ang - side * 0.5) * legLen * 0.5;
        g.strokeStyle = INK;
        g.lineWidth = legW + 1.2;
        g.beginPath();
        g.moveTo(ax, side * ry * 0.6);
        g.lineTo(kneeX, kneeY);
        g.lineTo(footX, footY);
        g.stroke();
        g.strokeStyle = '#ebe5da';
        g.lineWidth = legW;
        g.stroke();
        if (p.prehensile >= 1) {
          g.strokeStyle = INK;
          g.lineWidth = 0.8;
          g.beginPath();
          g.arc(footX, footY, 1.2 + p.prehensile * 0.5, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
  }

  // --- Fins ---
  if (p.fins >= 2) {
    g.fillStyle = 'rgba(200,205,210,0.75)';
    g.strokeStyle = INK;
    g.lineWidth = 0.9;
    const fl = 3 + p.fins * 2.2;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(bx + rx * 0.2, side * ry * 0.85);
      g.lineTo(bx - rx * 0.15 - stride * side * 1.5, side * (ry + fl));
      g.lineTo(bx - rx * 0.4, side * ry * 0.8);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  // --- Fur halo ---
  if (furLen > 1.5) {
    g.strokeStyle = 'rgba(235,228,214,0.95)';
    g.lineWidth = 1;
    const n = 60;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x0 = bx + Math.cos(a) * rx;
      const y0 = Math.sin(a) * ry;
      const l = furLen * (0.6 + 0.6 * rnd());
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l * 1.2);
      g.stroke();
    }
  }

  // --- Body ---
  const wiggle = legless ? stride * 1.5 : 0;
  const bodyPath = () => {
    g.beginPath();
    if (legless) {
      // Serpentine body.
      const seg = 10;
      for (let s = 0; s <= seg; s++) {
        const u = s / seg;
        const x = bx + rx - u * 2 * rx;
        const y =
          Math.sin(u * Math.PI * 2 + (frame === 0 ? 0 : frame === 1 ? 1 : -1)) * wiggle -
          ry * Math.sin(u * Math.PI) * 0.95;
        if (s === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      for (let s = seg; s >= 0; s--) {
        const u = s / seg;
        const x = bx + rx - u * 2 * rx;
        const y =
          Math.sin(u * Math.PI * 2 + (frame === 0 ? 0 : frame === 1 ? 1 : -1)) * wiggle +
          ry * Math.sin(u * Math.PI) * 0.95;
        g.lineTo(x, y);
      }
      g.closePath();
    } else {
      g.ellipse(bx, 0, rx, ry, 0, 0, Math.PI * 2);
    }
  };
  const grad = g.createRadialGradient(bx + rx * 0.2, -ry * 0.3, 1, bx, 0, rx);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#ddd6c8');
  g.fillStyle = grad;
  bodyPath();
  g.fill();

  // --- Pattern (clipped to the body) ---
  g.save();
  bodyPath();
  g.clip();
  if (p.stripes >= 1) {
    g.strokeStyle = `rgba(90,82,75,${0.25 + 0.15 * p.stripes})`;
    g.lineWidth = 1.2 + p.stripes * 0.5;
    const count = 3 + p.stripes * 2;
    for (let k = 0; k < count; k++) {
      const x = bx + rx * 0.7 - (k / (count - 1)) * rx * 1.6;
      g.beginPath();
      g.moveTo(x + 1, -ry);
      g.quadraticCurveTo(x - 1.5, 0, x + 1, ry);
      g.stroke();
    }
  }
  if (p.spots >= 1) {
    g.fillStyle = `rgba(80,72,66,${0.3 + 0.15 * p.spots})`;
    const count = 4 + p.spots * 5;
    for (let k = 0; k < count; k++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd());
      g.beginPath();
      g.arc(
        bx + Math.cos(a) * rx * r * 0.85,
        Math.sin(a) * ry * r * 0.85,
        0.8 + rnd() * (0.6 + p.spots * 0.5),
        0,
        Math.PI * 2,
      );
      g.fill();
    }
  }
  if (p.armor >= 1) {
    g.strokeStyle = INK;
    g.fillStyle = `rgba(150,140,130,${0.25 + 0.15 * p.armor})`;
    g.lineWidth = 0.9;
    const plates = 3 + p.armor * 2;
    for (let k = 0; k < plates; k++) {
      const x = bx + rx * 0.75 - (k / plates) * rx * 1.7;
      g.beginPath();
      g.ellipse(x, 0, (rx * 1.7) / plates / 1.6, ry * 0.85, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
  g.restore();

  // --- Outline (ink, slightly doubled for a hand-drawn feel) ---
  g.strokeStyle = INK;
  g.lineWidth = 1.4;
  bodyPath();
  g.stroke();
  g.save();
  g.translate(0.4, -0.3);
  g.strokeStyle = INK_SOFT;
  g.lineWidth = 0.7;
  bodyPath();
  g.stroke();
  g.restore();

  // --- Spines ---
  if (p.spines >= 1) {
    g.fillStyle = INK;
    const count = 5 + p.spines * 4;
    const len = 1.8 + p.spines * 1.4;
    for (let k = 0; k < count; k++) {
      const a = Math.PI * 0.15 + (k / (count - 1)) * Math.PI * 1.7;
      const ex = bx - Math.cos(a) * rx;
      const ey = Math.sin(a) * ry * (k % 2 ? 1 : -1);
      const nx = -Math.cos(a) * 0.6;
      const ny = Math.sign(ey) * 1;
      g.beginPath();
      g.moveTo(ex - 0.8, ey);
      g.lineTo(ex + nx * len, ey + ny * len);
      g.lineTo(ex + 0.8, ey);
      g.closePath();
      g.fill();
    }
  }

  // --- Head: a rounded head with a short snout, eyes on its sides ---
  const headR = Math.max(3.2, ry * 0.62);
  const hx = bx + rx + headR * 0.55;
  g.fillStyle = '#f7f3ec';
  g.strokeStyle = INK;
  g.lineWidth = 1.3;
  g.beginPath();
  g.ellipse(hx, 0, headR * 1.05, headR * 0.85, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Snout.
  g.beginPath();
  g.ellipse(hx + headR * 0.85, 0, headR * 0.45, headR * 0.4, 0, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.fillStyle = '#1d1815';
  g.beginPath();
  g.arc(hx + headR * 1.25, 0, 0.6, 0, Math.PI * 2);
  g.fill();
  const eyeR = 0.6 + p.eyes * 0.7;
  for (const side of [-1, 1]) {
    g.fillStyle = '#fffdf8';
    g.beginPath();
    g.arc(hx + headR * 0.15, side * headR * 0.55, eyeR + 0.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.7;
    g.stroke();
    g.fillStyle = '#1d1815';
    g.beginPath();
    g.arc(hx + headR * 0.15 + 0.3, side * headR * 0.55, eyeR * 0.62, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  return c;
}
