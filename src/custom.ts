// Custom motif: strokes a person draws in a unit square, repeated by a wallpaper group. Pure logic.
import type { Pt } from './patterns/util.ts';
import { applyGroup, GROUP_OPS } from './patterns/symmetry.ts';
import { simplify } from './vectorize.ts';

export interface CustomMotif {
  readonly strokes: readonly (readonly Pt[])[];
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// Clamps to 0..1, drops consecutive duplicates, then Ramer-Douglas-Peucker. The caller drops results under 2 points.
export function normalizeStroke(points: readonly Pt[], tolerance = 0.004): Pt[] {
  const out: Pt[] = [];
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p: Pt = [clamp(x, 0, 1), clamp(y, 0, 1)];
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return simplify(out, tolerance);
}

export function customGeometry(m: CustomMotif, group: string, cells: number, size: number): Pt[][] {
  if (m.strokes.length === 0) return [];
  return applyGroup(GROUP_OPS[group] ? group : 'p1', m.strokes, clamp(Math.round(cells) || 1, 1, 4), size);
}

const MAX_STROKES = 40;
const MAX_POINTS = 400;

// '0.0.500.500_100.900.200.800': x and y times 999, points joined by '.', strokes by '_'.
export function encodeMotif(m: CustomMotif): string {
  return m.strokes
    .map((s) => s.map(([x, y]) => `${Math.round(clamp(x, 0, 1) * 999)}.${Math.round(clamp(y, 0, 1) * 999)}`).join('.'))
    .join('_');
}

// Untrusted input: never throws, keeps only digits, '.', '_'; clamps, drops short strokes, caps size.
export function decodeMotif(s: string): CustomMotif {
  const strokes: Pt[][] = [];
  let total = 0;
  for (const part of String(s)
    .replace(/[^0-9._]/g, '')
    .split('_')) {
    if (strokes.length >= MAX_STROKES || total >= MAX_POINTS) break;
    const v = part
      .split('.')
      .filter((t) => t !== '')
      .map((t) => clamp(Number(t.slice(0, 6)), 0, 999) / 999);
    const pts: Pt[] = [];
    for (let i = 0; i + 1 < v.length && total + pts.length < MAX_POINTS; i += 2) pts.push([v[i]!, v[i + 1]!]);
    if (pts.length < 2) continue;
    strokes.push(pts);
    total += pts.length;
  }
  return { strokes };
}
