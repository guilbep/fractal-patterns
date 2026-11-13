// Palettes built on two studies of color preference:
// A. Schloss and Palmer (2011), "Aesthetic response to color combinations: preference, harmony, and similarity",
//    Attention, Perception and Psychophysics 73, 551-571, https://pmc.ncbi.nlm.nih.gov/articles/PMC3037488/
//    Harmony and preference fall as the hue difference grows (no complements); lightness contrast helps;
//    cool pairs and a warm figure on a cool ground are preferred; saturated figures on desaturated grounds.
// B. Palmer and Schloss (2010), "An ecological valence theory of human color preference", PNAS 107, 8877-8882,
//    https://pmc.ncbi.nlm.nih.gov/articles/PMC2889342/
//    Blue and cyan are liked most; dark yellow (olive) and dark orange (brown) least; saturated colors are liked.
// The numbers below (hue windows, lightness, chroma caps) are our inference from those findings, not values
// from the papers. The tests in palettes.test.ts check them against the contrast rules.
import { relativeLuminance } from './contrast.ts';
import { maxChroma, oklchToHex } from './oklch.ts';
import { pickRoles, type Roles } from './pairing.ts';

export interface Palette {
  readonly name: string;
  readonly colors: readonly string[];
}

// "near": accent 35 degrees from the base. "warm": warm accent (hue 40) on a cool base.
export type AccentMode = 'near' | 'warm';
export interface PaletteSpec {
  readonly name: string;
  readonly hue: number;
  readonly accent: AccentMode;
  readonly dark: boolean;
}

export type Lch = readonly [number, number, number];

const NEAR = 35;
const WARM = 40;
const ACCENT_CAP = 0.19;
const STROKE_SHARE = 0.6;
// Lightness per role, light and dark ground. Dark stroke stays at 0.6 so light ink keeps AA over it.
const L = {
  light: { paper: 0.975, ink: 0.24, stroke: 0.66, accent: 0.58, soft: 0.91 },
  dark: { paper: 0.23, ink: 0.94, stroke: 0.6, accent: 0.7, soft: 0.32 },
};
const PAPER_C = { light: 0.012, dark: 0.02 };
const INK_C = { light: 0.035, dark: 0.02 };
const SOFT_C = 0.045;

const wrap = (h: number): number => ((h % 360) + 360) % 360;
export const isCool = (h: number): boolean => h >= 180 && h <= 280;
// No dark yellow, olive or brown: hues 60 to 115 move to amber (50) or green (130).
export const safeHue = (h: number): number => {
  const w = wrap(h);
  return w < 60 || w > 115 ? w : w < 88 ? 50 : 130;
};

// The five colors as OKLCH, in order: paper, ink, stroke, accent, soft. Every one is inside sRGB.
export function paletteLch(s: PaletteSpec): [Lch, Lch, Lch, Lch, Lch] {
  const k = s.dark ? 'dark' : 'light';
  const l = L[k];
  const base = safeHue(s.hue);
  const accentHue = safeHue(s.accent === 'warm' ? WARM : base + NEAR);
  const fit = (lum: number, c: number, h: number): Lch => [lum, Math.min(c, maxChroma(lum, h)), h];
  const accent = fit(l.accent, ACCENT_CAP, accentHue);
  return [
    fit(l.paper, PAPER_C[k], base),
    fit(l.ink, INK_C[k], base),
    fit(l.stroke, STROKE_SHARE * Math.min(ACCENT_CAP, maxChroma(l.stroke, base)), base),
    accent,
    fit(l.soft, SOFT_C, base),
  ];
}

export function makePalette(s: PaletteSpec): Palette {
  return { name: s.name, colors: paletteLch(s).map(([l, c, h]) => oklchToHex(l, c, h)) };
}

// Roles for a palette: on a dark palette the dark paper is the background, the stroke the pattern.
export function paletteRoles(colors: readonly string[]): Roles {
  const [paper, ink, stroke] = colors as [string, string, string];
  return paletteIsDark(colors) ? { background: paper, pattern: stroke, text: ink } : pickRoles(colors);
}

export const paletteIsDark = (colors: readonly string[]): boolean => relativeLuminance(colors[0]!) < relativeLuminance(colors[1]!);

const spec = (name: string, hue: number, accent: AccentMode, dark = false): PaletteSpec => ({ name, hue, accent, dark });

export const PALETTE_SPECS: readonly PaletteSpec[] = [
  spec('Lagoon', 200, 'near'),
  spec('Harbor', 230, 'warm'),
  spec('Glacier', 250, 'near'),
  spec('Slate', 260, 'warm'),
  spec('Lake', 215, 'warm'),
  spec('Dusk', 275, 'near'),
  spec('Fjord', 190, 'warm'),
  spec('Sky', 240, 'near'),
  spec('Tide', 185, 'near'),
  spec('Mint', 165, 'near'),
  spec('Fern', 145, 'near'),
  spec('Meadow', 135, 'near'),
  spec('Lilac', 300, 'near'),
  spec('Rose', 350, 'near'),
  spec('Brick', 28, 'near'),
  spec('Clay', 40, 'near'),
  spec('Night', 255, 'warm', true),
  spec('Deep sea', 220, 'warm', true),
  spec('Ink', 265, 'near', true),
  spec('Midnight', 270, 'warm', true),
  spec('Reef', 195, 'near', true),
  spec('Pine', 150, 'near', true),
  spec('Ember', 25, 'near', true),
  spec('Plum', 325, 'near', true),
];

export const PALETTES: readonly Palette[] = PALETTE_SPECS.map(makePalette);
export const DARK_NAMES: ReadonlySet<string> = new Set(PALETTE_SPECS.filter((s) => s.dark).map((s) => s.name));

// A random spec inside the same rules: base hue weighted to blue and cyan, about 1 in 3 dark,
// a warm accent only on a cool base.
export function randomPaletteSpec(rnd: () => number): PaletteSpec {
  const hue = Math.round(rnd() < 0.6 ? 180 + rnd() * 100 : rnd() * 360);
  const dark = rnd() < 1 / 3;
  const accent: AccentMode = isCool(hue) && rnd() < 0.5 ? 'warm' : 'near';
  return spec('Random', hue, accent, dark);
}
