// The Studio gallery generator (MAP-Elites): a grid of descriptor cells, density x stem curl x palette mood, keeps the
// best-balanced design found for each cell. Pure and seeded; scripts/studio-gallery.ts runs it and writes the files.
import { PALETTES, DARK_NAMES, type Palette } from '../palettes.ts';
import { breed } from './breed.ts';
import { compose, studioTracking, THEMES, themeFamilies } from './compose.ts';
import { GENE_MAX, GENES, type GeneId } from './genes.ts';
import { studioSvg } from './model.ts';
import { DEFAULT_DESIGN, designOptions, encodeStudio, MAX_SEED, REPEATS, type StudioDesign } from './studio-share.ts';

export const MOODS = ['light warm', 'light cool', 'dark warm', 'dark cool'] as const;
export type Mood = (typeof MOODS)[number];

/** Warm: the accent color has more red than blue. */
export function moodOf(p: Palette): Mood {
  const accent = p.colors[3] ?? p.colors[1] ?? '#808080';
  const warm = parseInt(accent.slice(1, 3), 16) > parseInt(accent.slice(5, 7), 16);
  return `${DARK_NAMES.has(p.name) ? 'dark' : 'light'} ${warm ? 'warm' : 'cool'}` as Mood;
}

export interface Cell {
  readonly density: number; // 0..3: quarters of the density range
  readonly curl: number; // 0..3: quarters of the stem curl gene (absent: 1, the default curl 0.75)
  readonly mood: Mood;
}
export const cellOf = (d: StudioDesign): Cell => ({
  density: Math.min(3, Math.floor(d.density * 4)),
  curl: d.genes.stemCurl === undefined ? 1 : Math.floor(d.genes.stemCurl / 4),
  mood: moodOf(d.palette),
});
const keyOf = (c: Cell) => `${c.density}/${c.curl}/${c.mood}`;

export interface Elite {
  readonly cell: Cell;
  readonly design: StudioDesign;
  readonly link: string;
  /** Tracking score: lower is better. */
  readonly score: number;
  readonly svg: string;
}

function randomDesign(rnd: () => number): StudioDesign {
  const theme = THEMES[Math.floor(rnd() * THEMES.length)]!.id;
  const genes: Partial<Record<GeneId, number>> = {};
  for (const { id } of GENES) if (rnd() < 0.3) genes[id] = Math.floor(rnd() * (GENE_MAX + 1));
  return {
    ...DEFAULT_DESIGN,
    seed: Math.floor(rnd() * MAX_SEED),
    palette: PALETTES[Math.floor(rnd() * PALETTES.length)]!,
    repeat: REPEATS[Math.floor(rnd() * REPEATS.length)]!,
    density: Math.round(rnd() * 100) / 100,
    theme,
    stems: theme !== 'sea',
    families: themeFamilies(theme).map((f) => f.id),
    genes,
  };
}

export function evaluate(d: StudioDesign): { score: number; svg: string } {
  const s = compose(designOptions(d));
  return { score: studioTracking(s)?.score ?? Infinity, svg: studioSvg(s) };
}

/** `initial` random designs, then `iterations` children of random elites (a palette swap now and then, so the
 * mood axis is explored). Returns the elites, one per filled cell, in cell order. */
export function mapElites(o: { rnd: () => number; initial: number; iterations: number }): Elite[] {
  const elites = new Map<string, Elite>();
  const offer = (design: StudioDesign) => {
    const cell = cellOf(design);
    const key = keyOf(cell);
    const { score, svg } = evaluate(design);
    const old = elites.get(key);
    if (!old || score < old.score) elites.set(key, { cell, design, link: encodeStudio(design), score, svg });
  };
  for (let i = 0; i < o.initial; i++) offer(randomDesign(o.rnd));
  for (let i = 0; i < o.iterations; i++) {
    const pool = [...elites.values()];
    const parent = pool[Math.floor(o.rnd() * pool.length)]!.design;
    const child = breed([parent], 0.6, o.rnd);
    offer(o.rnd() < 0.3 ? { ...child, palette: PALETTES[Math.floor(o.rnd() * PALETTES.length)]! } : child);
  }
  const order = (e: Elite) => MOODS.indexOf(e.cell.mood) * 16 + e.cell.density * 4 + e.cell.curl;
  return [...elites.values()].sort((a, b) => order(a) - order(b));
}
