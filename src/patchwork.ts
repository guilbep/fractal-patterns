// Patchwork: a tile split into a grid of cells, each cell a different seeded kind.
// Every kind is a self-contained repeating tile, so cells drawn at cell size and moved into place repeat seamlessly.
import {
  KINDS,
  KIND_FAMILY,
  MAX_DEPTH,
  geometry,
  svgFromPolylines,
  tileAspect,
  type Family,
  type Kind,
  type PatternParams,
} from './fractal.ts';
import { mulberry32, type Pt } from './patterns/util.ts';

export interface PatchworkParams {
  readonly seed: number;
  readonly cells: number;
  readonly families: readonly Family[];
  readonly pinned: Readonly<Record<number, Kind>>;
  readonly frame: boolean;
  readonly depth: number;
  readonly size: number;
}

export interface PatchCell {
  readonly index: number;
  readonly kind: Kind;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly polys: readonly (readonly Pt[])[];
}

const gridOf = (cells: number): number => Math.min(4, Math.max(1, Math.floor(cells) || 1));

// Small cells blur at depth 3+: cap at 3 for a 2x2 grid and 2 for 3x3 and 4x4.
const depthCap = (n: number): number => (n >= 3 ? 2 : n === 2 ? 3 : Infinity);

export function cellSeed(seed: number, index: number): number {
  const rnd = mulberry32(seed);
  let r = 0;
  for (let i = 0; i <= index; i++) r = rnd();
  return Math.floor(r * 4294967296) >>> 0;
}

export function patchworkCells(p: PatchworkParams): PatchCell[] {
  const n = gridOf(p.cells);
  const cs = p.size / n;
  // Seeded shuffle of the allowed kinds; cell i takes entry i, so cells differ until the set runs out (13 surfaces < 16 cells).
  // Square kinds only: a cell is square. A families set with only rectangular kinds falls back to 'tree' below.
  const allowed = KINDS.filter((k) => tileAspect(k) === 1 && (p.families.length === 0 || p.families.includes(KIND_FAMILY[k])));
  const rnd = mulberry32(p.seed ^ 0x9e3779b9);
  for (let i = allowed.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [allowed[i], allowed[j]] = [allowed[j]!, allowed[i]!];
  }
  const out: PatchCell[] = [];
  for (let index = 0; index < n * n; index++) {
    const s = cellSeed(p.seed, index);
    const pin = p.pinned[index];
    const kind = (pin && tileAspect(pin) === 1 ? pin : undefined) ?? allowed[index % allowed.length] ?? 'tree';
    const x = (index % n) * cs;
    const y = Math.floor(index / n) * cs;
    const depth = Math.min(p.depth, MAX_DEPTH[kind], depthCap(n));
    const polys = geometry({ kind, seed: s, depth, size: cs }).map((poly) => poly.map(([px, py]): Pt => [px + x, py + y]));
    out.push({ index, kind, x, y, size: cs, polys });
  }
  return out;
}

export function patchworkGeometry(p: PatchworkParams): (readonly Pt[])[] {
  const polys: (readonly Pt[])[] = patchworkCells(p).flatMap((c) => c.polys);
  if (p.frame) {
    const n = gridOf(p.cells);
    for (let j = 0; j <= n; j++) {
      const v = (j * p.size) / n;
      polys.push(
        [
          [v, 0],
          [v, p.size],
        ],
        [
          [0, v],
          [p.size, v],
        ],
      );
    }
  }
  return polys;
}

export function generatePatchwork(
  p: PatchworkParams,
  style: Pick<PatternParams, 'strokeWidth' | 'precision' | 'color' | 'opacity'>,
): string {
  return svgFromPolylines(patchworkGeometry(p), { size: p.size, ...style });
}
