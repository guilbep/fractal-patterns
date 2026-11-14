// Color each region, loaded on demand with patterns/regions.ts: the faces of a tile, their colours, the SVG and the
// panel's note. state.ts keeps only the reactive glue, so the start JavaScript stays as it was.
import { arrangement, colourFaces, regionsSvg } from '@/patterns/regions.ts';
import { wrap, type Poly, type Pt } from '@/patterns/util.ts';
import { blend } from '@/contrast.ts';

export type Regions = ReturnType<typeof findRegions>;

// The faces of the wrapped tile lines; past a limit, a reason and no colouring (the tile keeps its lines only).
// A rectangular tile (aspect = width / height, e.g. 1 by sqrt(3)) is squeezed into the size by size square, where wrap()
// and the arrangement work; a squeeze keeps which regions touch. The loops are stretched back like the lines; the areas
// stay in the square (only compared with each other).
export function findRegions(polys: readonly (readonly Pt[])[], size: number, limits: { faces: number; ms: number }, aspect = 1) {
  const t0 = performance.now();
  const squeezed = aspect === 1 ? (polys as Poly[]) : polys.map((p) => p.map(([x, y]): Pt => [x, y * aspect]));
  const a = arrangement(wrap(squeezed, size), size);
  if (aspect !== 1) a.faces = a.faces.map((f) => ({ ...f, loops: f.loops.map((l) => l.map(([x, y]): Pt => [x, y / aspect])) }));
  const ms = performance.now() - t0;
  const reason =
    a.faces.length > limits.faces
      ? `${a.faces.length} regions are too many to color: lines only.`
      : ms > limits.ms
        ? `Finding the regions took ${Math.round(ms)} ms, too slow: lines only.`
        : '';
  return { ...a, ms, reason };
}

// The region paths (drawn under the lines), the note for the panel, the count and the time.
export function colourRegions(r: Regions, mode: string, k: number, colors: readonly string[]) {
  const n = { faces: r.faces.length, ms: r.ms };
  if (r.reason) return { ...n, svg: '', ok: true, note: r.reason };
  const c = colourFaces(r.faces, r.adjacency, mode === 'shape' ? 'shape' : 'neighbours', k);
  return {
    ...n,
    svg: regionsSvg(r.faces, c.colour, colors, 0),
    ok: c.ok,
    note: c.ok ? '' : `${k} colors are not enough here: neighbours may share a color.`,
  };
}

// The region colours: the candidates (the palette's colours, then the fill and the accent) other than the background,
// the stroke and the text (the text sits on the regions, so it cannot be one of them); padded with each of those half
// way to the background. The first `k`.
// ponytail: a palette with fewer than 2 such colours gives fewer than 4; those regions stay unfilled.
export function regionPalette(candidates: readonly string[], roles: { background: string; pattern: string; text: string }, k: number) {
  const { background } = roles;
  const base = [...new Set(candidates)].filter((c) => c !== background && c !== roles.pattern && c !== roles.text);
  return [...new Set([...base, ...base.map((c) => blend(c, background, 0.5))])].slice(0, k);
}
