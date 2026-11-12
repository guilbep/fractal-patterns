import { oklchToHex } from './oklch.ts';

export interface Palette {
  readonly name: string;
  readonly colors: readonly string[];
}

export const SCHEMES = ['mono', 'analogous', 'complement', 'triad'] as const;
export type Scheme = (typeof SCHEMES)[number];

// Second and third hue of each scheme, as offsets from the base hue.
const OFFSETS: Record<Scheme, readonly [number, number]> = {
  mono: [0, 0],
  analogous: [30, -30],
  complement: [180, 180],
  triad: [120, 240],
};

// OKLCH lightness and chroma per job. The stroke sits between the lightness that keeps
// dark text at AAA over it on paper and the lightness that keeps light text at AA over it on ink.
const PAPER = { l: 0.975, c: 0.012 };
const INK = { l: 0.24, c: 0.035 };
const STROKE = { l: 0.68, c: 0.1 };
const ACCENT = { l: 0.56, c: 0.15 };
const SOFT = { l: 0.91, c: 0.04 };

// Colors in order: paper, ink, stroke, accent, soft.
export function makePalette(name: string, hue: number, scheme: Scheme): Palette {
  const [d2, d3] = OFFSETS[scheme];
  const h2 = (hue + d2 + 360) % 360;
  const h3 = (hue + d3 + 360) % 360;
  return {
    name,
    colors: [
      oklchToHex(PAPER.l, PAPER.c, hue),
      oklchToHex(INK.l, INK.c, hue),
      oklchToHex(STROKE.l, STROKE.c, h2),
      oklchToHex(ACCENT.l, ACCENT.c, h3),
      oklchToHex(SOFT.l, SOFT.c, h2),
    ],
  };
}

const HUES: readonly (readonly [string, number])[] = [
  ['Brick', 25],
  ['Ochre', 75],
  ['Moss', 145],
  ['Lagoon', 200],
  ['Indigo', 260],
  ['Plum', 320],
];

export const PALETTE_SPECS: readonly (readonly [string, number, Scheme])[] = HUES.flatMap(([word, hue]) =>
  SCHEMES.map((s) => [`${word}, ${s}`, hue, s] as const),
);

export const PALETTES: readonly Palette[] = PALETTE_SPECS.map(([name, hue, scheme]) => makePalette(name, hue, scheme));
