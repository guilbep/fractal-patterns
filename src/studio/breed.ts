// Breed: new Studio designs from one or two parents. Pure (the panel, the worker and the gallery script share it).
// The child keeps the first parent's choices (theme, palette, repeat, size, options) and mixes the parents' genes;
// `difference` (0 more similar, 1 more different) sets how many genes mutate, how far, and how often the seed changes.
import { compose, studioTracking } from './compose.ts';
import { GENE_MAX, GENES, type GeneId } from './genes.ts';
import { repeatCell, studioSvg } from './model.ts';
import { designOptions, encodeStudio, MAX_SEED, type StudioDesign } from './studio-share.ts';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function breed(parents: readonly StudioDesign[], difference: number, rnd: () => number): StudioDesign {
  const d = clamp(difference, 0, 1);
  const first = parents[Math.floor(rnd() * parents.length)]!;
  const rate = 0.08 + 0.42 * d; // chance per gene
  const reach = 1 + Math.round(d * 7); // largest step of a mutation
  const genes: Partial<Record<GeneId, number>> = {};
  let mutated = false;
  for (const { id } of GENES) {
    let v = parents[Math.floor(rnd() * parents.length)]!.genes[id];
    if (rnd() < rate) {
      v =
        v === undefined
          ? Math.floor(rnd() * (GENE_MAX + 1))
          : clamp(v + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * reach)), 0, GENE_MAX);
      mutated = true;
    }
    if (v !== undefined) genes[id] = v;
  }
  const newSeed = rnd() < 0.7 * d;
  if (!mutated && !newSeed) {
    // Never a copy of the parent: one gene moves.
    const { id } = GENES[Math.floor(rnd() * GENES.length)]!;
    genes[id] = Math.floor(rnd() * (GENE_MAX + 1));
  }
  return {
    ...first,
    families: [...first.families],
    seed: newSeed ? Math.floor(rnd() * MAX_SEED) : first.seed,
    density: Math.round(clamp(first.density + (rnd() * 2 - 1) * 0.25 * d, 0, 1) * 100) / 100,
    genes,
  };
}

/** What a thumbnail needs: the tile as a data URI, its background and cell size, and the tracking score. */
export interface Grown {
  readonly uri: string;
  readonly bg: string;
  readonly width: number;
  readonly height: number;
  /** Lower is better; above TRACKING_LIMIT the repeat shows. */
  readonly score: number;
}

export function grow(d: StudioDesign): Grown {
  const s = compose(designOptions(d));
  const cell = repeatCell(s);
  // ponytail: encodeURIComponent, not svgToDataUri's smaller escaping: the worker should not pull css.ts's imports.
  return {
    uri: `data:image/svg+xml,${encodeURIComponent(studioSvg(s))}`,
    bg: s.background ?? 'transparent',
    width: cell.width,
    height: cell.height,
    score: studioTracking(s)?.score ?? 0,
  };
}

/** One generation of up to `n` distinct children (by link), none equal to a parent. */
export function generation(parents: readonly StudioDesign[], difference: number, rnd: () => number, n = 9): StudioDesign[] {
  const seen = new Set(parents.map(encodeStudio));
  const out: StudioDesign[] = [];
  for (let tries = 0; out.length < n && tries < n * 20; tries++) {
    const c = breed(parents, difference, rnd);
    const key = encodeStudio(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}
