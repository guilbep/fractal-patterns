// Ways to show a tile's repeat less often: a mirrored 2 x 2 block written with one path, and the
// measurement behind the orientation option of the super tile. Pure.
import { generate, geometry, hasCompat, MAX_DEPTH, type Kind } from './fractal.ts';
import type { Pt } from './patterns/util.ts';
import { pathData } from './scene.ts';
import { safeColor, SUPER_CELLS, superTileSvg, VARIANT_KINDS, type SuperTileOptions } from './supertile.ts';

type Geo = readonly (readonly Pt[])[];
const EPS = 1e-6;

// A tile and its mirror image agree along the mirror line, so this block repeats seamlessly for
// any kind: tile, flipped left-right; flipped top-bottom, flipped both.
export function mirrorSuperSvg(o: SuperTileOptions): string {
  const S = o.size;
  const s = 2 * S;
  const d = pathData(geometry({ kind: o.kind, seed: o.seed, depth: o.depth, size: S }), o.precision);
  const g = `<g fill="none" stroke="${safeColor(o.color)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.opacity}" stroke-linecap="round">`;
  const uses = ['', `translate(${s} 0) scale(-1 1)`, `translate(0 ${s}) scale(1 -1)`, `translate(${s} ${s}) scale(-1 -1)`]
    .map((t) => `<use href="#a"${t ? ` transform="${t}"` : ''}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><defs><path id="a" d="${d}"/></defs>${g}${uses}</g></svg>`;
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

export function repetitionBytes(o: SuperTileOptions): { svg: number; plain: number; period: number } {
  return {
    svg: bytes(superTileSvg(o)),
    plain: bytes(generate({ ...o, color: safeColor(o.color), compat: true })),
    period: o.cells ?? SUPER_CELLS,
  };
}

// Boundary signature of one edge (axis 0: x = at, axis 1: y = at): sorted, merged positions along
// the edge where the geometry touches or crosses it, and the sorted [lo, hi] spans lying along it.
export interface Signature {
  readonly points: number[];
  readonly spans: [number, number][];
}
export function signature(geo: Geo, axis: 0 | 1, at: number): Signature {
  const o: 0 | 1 = axis === 0 ? 1 : 0;
  const on = (p: Pt) => Math.abs(p[axis] - at) < EPS;
  const raw: number[] = [];
  const spans: [number, number][] = [];
  for (const poly of geo) {
    for (const p of poly) if (on(p)) raw.push(p[o]);
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1]!;
      const b = poly[i]!;
      if (on(a) && on(b)) spans.push([Math.min(a[o], b[o]), Math.max(a[o], b[o])]);
      else if (!on(a) && !on(b) && (a[axis] - at) * (b[axis] - at) < 0) {
        const t = (at - a[axis]) / (b[axis] - a[axis]);
        raw.push(a[o] + t * (b[o] - a[o]));
      }
    }
  }
  return normalize(raw, spans);
}
function normalize(raw: number[], spans: [number, number][]): Signature {
  raw.sort((x, y) => x - y);
  spans.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  return { points: raw.filter((v, i) => i === 0 || v - raw[i - 1]! >= EPS), spans };
}
const near = (x: readonly number[], y: readonly number[]) => x.length === y.length && x.every((v, i) => Math.abs(v - y[i]!) < EPS);
export const sameSig = (a: Signature, b: Signature): boolean =>
  near(a.points, b.points) && a.spans.length === b.spans.length && a.spans.every((s, i) => near(s, b.spans[i]!));
const reversed = (a: Signature, size: number): Signature =>
  normalize(
    a.points.map((p) => size - p),
    a.spans.map(([lo, hi]) => [size - hi, size - lo]),
  );

// One geometry qualifies when its 4 edges have the same signature and it reads the same backwards.
export function orientable(geo: Geo, size: number): boolean {
  const [left, ...rest] = [signature(geo, 0, 0), signature(geo, 0, size), signature(geo, 1, 0), signature(geo, 1, size)];
  return rest.every((e) => sameSig(left!, e)) && sameSig(left!, reversed(left!, size));
}

// The measurement behind ORIENTATION_KINDS in src/supertile.ts: seeds 1..4, depth 2 and MAX_DEPTH, size 60.
export function measureOrientationKinds(): Kind[] {
  return VARIANT_KINDS.filter((kind) =>
    [2, MAX_DEPTH[kind]].every((depth) =>
      [1, 2, 3, 4].every((seed) => orientable(geometry({ kind, seed, depth, size: 60, compat: hasCompat(kind) }), 60)),
    ),
  );
}
