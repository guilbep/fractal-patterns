// The studio design as a compact URL hash query: s seed, p palette index, r repeat, d density,
// z tile size, st stems, t theme (f floral, s sea, o orchard), f families bit mask (bit i: the theme's i-th family). Only values that differ from the defaults are written.
import { PALETTES } from '../palettes.ts';
import { composeColors, themeFamilies, type ComposeOptions, type Theme, type ThemeFamily } from './compose.ts';
import type { Repeat } from './model.ts';
import { MOTIF_FAMILIES } from './motifs.ts';

export const REPEATS: readonly Repeat[] = ['straight', 'half-drop', 'brick', 'mirror'];
export const MAX_SEED = 0xffffffff;
export const SIZE_MIN = 200;
export const SIZE_MAX = 500;
export const SIZE_STEP = 20;
const ALL_FAMILIES = (1 << MOTIF_FAMILIES.length) - 1; // every theme has six families
const THEME_KEYS: Readonly<Record<Theme, string>> = { floral: 'f', sea: 's', orchard: 'o' };
const ids = (t: Theme): ThemeFamily[] => themeFamilies(t).map((f) => f.id);

export interface StudioDesign {
  seed: number;
  palette: number;
  repeat: Repeat;
  density: number;
  size: number;
  stems: boolean;
  theme: Theme;
  families: ThemeFamily[];
}

export const DEFAULT_DESIGN: Readonly<StudioDesign> = {
  seed: 1,
  palette: 0,
  repeat: 'straight',
  density: 0.4,
  size: 300,
  stems: true,
  theme: 'floral',
  families: [...MOTIF_FAMILIES],
};

const mask = (t: Theme, fs: readonly ThemeFamily[]): number => ids(t).reduce((m, f, i) => (fs.includes(f) ? m | (1 << i) : m), 0);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

export function encodeStudio(d: StudioDesign): string {
  const q = new URLSearchParams();
  const D = DEFAULT_DESIGN;
  if (d.seed !== D.seed) q.set('s', String(d.seed));
  if (d.palette !== D.palette) q.set('p', String(d.palette));
  if (d.repeat !== D.repeat) q.set('r', String(REPEATS.indexOf(d.repeat)));
  if (round2(d.density) !== D.density) q.set('d', String(round2(d.density)));
  if (d.size !== D.size) q.set('z', String(d.size));
  if (d.stems !== D.stems) q.set('st', d.stems ? '1' : '0');
  if (d.theme !== D.theme) q.set('t', THEME_KEYS[d.theme]);
  const f = mask(d.theme, d.families);
  if (f !== ALL_FAMILIES) q.set('f', String(f));
  return q.toString();
}

/** Never throws: anything missing or malformed takes its default; numbers are clamped into range. */
export function decodeStudio(hash: string): StudioDesign {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const D = DEFAULT_DESIGN;
  const num = (k: string): number | null => {
    const raw = q.get(k);
    if (raw === null || raw.trim() === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  };
  const int = (k: string, lo: number, hi: number, def: number): number => {
    const v = num(k);
    return v === null ? def : clamp(Math.round(v), lo, hi);
  };
  const density = num('d');
  const size = int('z', SIZE_MIN, SIZE_MAX, D.size);
  const f = int('f', 0, ALL_FAMILIES, ALL_FAMILIES);
  const theme = (Object.keys(THEME_KEYS) as Theme[]).find((t) => THEME_KEYS[t] === q.get('t')) ?? D.theme;
  const families = ids(theme).filter((_, i) => f & (1 << i));
  return {
    seed: int('s', 0, MAX_SEED, D.seed),
    palette: int('p', 0, PALETTES.length - 1, D.palette),
    repeat: REPEATS[int('r', 0, REPEATS.length - 1, 0)]!,
    density: density === null ? D.density : round2(clamp(density, 0, 1)),
    size: SIZE_MIN + Math.round((size - SIZE_MIN) / SIZE_STEP) * SIZE_STEP,
    stems: q.has('st') ? q.get('st') !== '0' : D.stems,
    theme,
    families: families.length > 0 ? families : ids(theme),
  };
}

export function designOptions(d: StudioDesign): ComposeOptions {
  return {
    seed: d.seed,
    width: d.size,
    height: d.size,
    repeat: d.repeat,
    density: d.density,
    families: d.families,
    theme: d.theme,
    colors: composeColors(PALETTES[d.palette]?.colors ?? []),
    stems: d.stems,
  };
}
