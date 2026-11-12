// The studio design as a compact URL hash query: s seed, p palette index, r repeat, d density,
// z tile size, st stems, f families bit mask. Only values that differ from the defaults are written.
import { PALETTES } from '../palettes.ts';
import { composeColors, type ComposeOptions } from './compose.ts';
import type { Repeat } from './model.ts';
import { MOTIF_FAMILIES, type MotifFamily } from './motifs.ts';

export const REPEATS: readonly Repeat[] = ['straight', 'half-drop', 'brick', 'mirror'];
export const MAX_SEED = 0xffffffff;
export const SIZE_MIN = 200;
export const SIZE_MAX = 500;
export const SIZE_STEP = 20;
const ALL_FAMILIES = (1 << MOTIF_FAMILIES.length) - 1;

export interface StudioDesign {
  seed: number;
  palette: number;
  repeat: Repeat;
  density: number;
  size: number;
  stems: boolean;
  families: MotifFamily[];
}

export const DEFAULT_DESIGN: Readonly<StudioDesign> = {
  seed: 1,
  palette: 0,
  repeat: 'straight',
  density: 0.4,
  size: 300,
  stems: true,
  families: [...MOTIF_FAMILIES],
};

const mask = (fs: readonly MotifFamily[]): number => MOTIF_FAMILIES.reduce((m, f, i) => (fs.includes(f) ? m | (1 << i) : m), 0);
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
  const f = mask(d.families);
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
  const families = MOTIF_FAMILIES.filter((_, i) => f & (1 << i));
  return {
    seed: int('s', 0, MAX_SEED, D.seed),
    palette: int('p', 0, PALETTES.length - 1, D.palette),
    repeat: REPEATS[int('r', 0, REPEATS.length - 1, 0)]!,
    density: density === null ? D.density : round2(clamp(density, 0, 1)),
    size: SIZE_MIN + Math.round((size - SIZE_MIN) / SIZE_STEP) * SIZE_STEP,
    stems: q.has('st') ? q.get('st') !== '0' : D.stems,
    families: families.length > 0 ? families : [...MOTIF_FAMILIES],
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
    colors: composeColors(PALETTES[d.palette]?.colors ?? []),
    stems: d.stems,
  };
}
