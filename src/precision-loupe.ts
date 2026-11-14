// The precision loupe: one square region of the tile, exact and rounded the way the export rounds. Pure: no DOM access.
import type { Pt } from './patterns/util.ts';
import { pathData } from './scene.ts';

type Polys = readonly (readonly Pt[])[];
export interface Region {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

// The runs of consecutive segments whose box meets the region, decided once from the exact points so both paths hold
// the same segments. ponytail: culling, not clipping; the loupe's viewBox clips the rest.
function runsIn(polys: Polys, { x, y, w }: Region): Pt[][] {
  const pad = 1; // a rounded point moves under 1 px, so a segment just outside can enter
  const meets = (a: Pt, b: Pt) =>
    Math.max(a[0], b[0]) >= x - pad &&
    Math.min(a[0], b[0]) <= x + w + pad &&
    Math.max(a[1], b[1]) >= y - pad &&
    Math.min(a[1], b[1]) <= y + w + pad;
  const runs: Pt[][] = [];
  for (const poly of polys) {
    let run: Pt[] = [];
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!;
      const b = poly[i]!;
      if (meets(a, b)) {
        if (run.length === 0) run.push(a);
        run.push(b);
      } else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

const exactData = (runs: readonly Pt[][]) => runs.map((run) => run.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')).join('');

// The largest distance any point of the tile moves when rounded to `precision` decimals (tile units).
export function maxShift(polys: Polys, precision: number): number {
  const f = 10 ** precision;
  const r = (v: number) => Math.round(v * f) / f;
  let max = 0;
  for (const poly of polys) for (const [x, y] of poly) max = Math.max(max, Math.hypot(r(x) - x, r(y) - y));
  return max;
}

// Exact and rounded path data of the region, and the largest shift over the whole tile (stable while the region moves).
// `size` is unused by the maths; the region is in the same tile units.
export function loupeView(
  polys: Polys,
  _size: number,
  precision: number,
  region: Region,
): { exact: string; rounded: string; maxShift: number } {
  const runs = runsIn(polys, region);
  return { exact: exactData(runs), rounded: pathData(runs, precision), maxShift: maxShift(polys, precision) };
}

// The 1/8 × 1/8 cell of the tile with the most segment ends, first in reading order on a tie.
export function busiestRegion(polys: Polys, width: number, height: number): Region {
  const w = width / 8;
  const cols = 8;
  const rows = Math.max(1, Math.floor(height / w));
  const counts = Array.from({ length: cols * rows }, () => 0);
  for (const poly of polys)
    for (const [x, y] of poly) {
      const c = Math.min(cols - 1, Math.max(0, Math.floor(x / w)));
      const r = Math.min(rows - 1, Math.max(0, Math.floor(y / w)));
      counts[r * cols + c]!++;
    }
  let best = 0;
  counts.forEach((n, i) => n > counts[best]! && (best = i));
  return clampRegion({ x: (best % cols) * w, y: Math.floor(best / cols) * w, w }, width, height);
}

export const clampRegion = (r: Region, width: number, height: number): Region => ({
  x: Math.min(Math.max(0, r.x), Math.max(0, width - r.w)),
  y: Math.min(Math.max(0, r.y), Math.max(0, height - r.w)),
  w: r.w,
});
