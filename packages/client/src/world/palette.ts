/** Watercolour field-notebook palette. */

export const PAPER = 0xf1e7d0;
export const INK = 0x2b2420;

/** Biome base colours [r, g, b] (grassland, forest, shrubland, sand, rock, shallow, deep). */
export const BIOME_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [196, 205, 140],
  [128, 158, 104],
  [172, 176, 118],
  [228, 208, 158],
  [170, 160, 148],
  [146, 184, 196],
  [96, 140, 168],
];

/** Player colours (Okabe–Ito, colour-blind safe) and ring dash patterns so colour is never the only cue. */
export const PLAYER_COLORS = [0xe69f00, 0x56b4e9, 0x009e73, 0xf0e442, 0x0072b2, 0xd55e00];
export const PLAYER_DASH: ReadonlyArray<readonly number[]> = [
  [],
  [4, 3],
  [1, 3],
  [6, 2, 1, 2],
  [2, 2],
  [8, 4],
];

/** Creature body colour from quantised hue, lightness and conspicuousness (0–15). */
export function creatureColor(hue: number, lightness: number, conspicuous: number): number {
  const h = (0.02 + 0.6 * ((hue + 0.5) / 16)) * 360;
  const s = 0.18 + 0.62 * ((conspicuous + 0.5) / 16);
  const l = 0.28 + 0.5 * ((lightness + 0.5) / 16);
  return hslToHex(h, s, l);
}

export function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) => Math.round((v + m) * 255);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

export function hexToCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
