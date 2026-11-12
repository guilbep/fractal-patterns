// Seeded pattern tiles: geometry as polylines, serialized to one compact SVG path.
// Every kind is one generator function registered in PATTERNS; the generators live in src/patterns/.
import { carpet, fold, hilbert, htree, koch, quadtree, sierpinski, tree } from './patterns/fractals.ts';
import { rosette, spiral, stitch, whirl } from './patterns/lineart.ts';
import { basket, brick, dots, herringbone, hex, nested, stack, trinet } from './patterns/surfaces.ts';
import { mulberry32, type Generator, type Pt } from './patterns/util.ts';

export const FAMILIES = ['fractal', 'line', 'surface', 'symmetry'] as const;
export type Family = (typeof FAMILIES)[number];

export const FAMILY_LABELS: Readonly<Record<Family, string>> = {
  fractal: 'Fractals',
  line: 'Line art',
  surface: 'Surfaces',
  symmetry: 'Symmetry groups',
};

export const KINDS = ['carpet', 'quadtree', 'tree', 'fold', 'hilbert', 'koch', 'sierpinski', 'htree', 'stitch', 'whirl', 'rosette', 'spiral', 'brick', 'stack', 'herringbone', 'basket', 'hex', 'trinet', 'nested', 'dots'] as const;
export type Kind = (typeof KINDS)[number];

// maxDepth: the measured worst case over many seeds stays near or under 20k chars at precision 1,
// and one level more either breaks that or only adds sub-pixel detail at size 120.
const PATTERNS: Readonly<Record<Kind, { family: Family; label: string; maxDepth: number; gen: Generator }>> = {
  carpet: { family: 'fractal', label: 'Carpet', maxDepth: 3, gen: carpet },
  quadtree: { family: 'fractal', label: 'Quadtree', maxDepth: 6, gen: quadtree },
  tree: { family: 'fractal', label: 'Tree', maxDepth: 10, gen: tree },
  fold: { family: 'fractal', label: 'Folded curve', maxDepth: 10, gen: fold },
  hilbert: { family: 'fractal', label: 'Hilbert curve', maxDepth: 5, gen: hilbert },
  koch: { family: 'fractal', label: 'Koch lattice', maxDepth: 3, gen: koch },
  sierpinski: { family: 'fractal', label: 'Sierpinski', maxDepth: 5, gen: sierpinski },
  htree: { family: 'fractal', label: 'H-tree', maxDepth: 8, gen: htree },
  stitch: { family: 'line', label: 'Curve stitching', maxDepth: 6, gen: stitch },
  whirl: { family: 'line', label: 'Whirl', maxDepth: 16, gen: whirl },
  rosette: { family: 'line', label: 'Rosette', maxDepth: 5, gen: rosette },
  spiral: { family: 'line', label: 'Spirals', maxDepth: 8, gen: spiral },
  brick: { family: 'surface', label: 'Running bond', maxDepth: 8, gen: brick },
  stack: { family: 'surface', label: 'Stack bond', maxDepth: 8, gen: stack },
  herringbone: { family: 'surface', label: 'Herringbone', maxDepth: 3, gen: herringbone },
  basket: { family: 'surface', label: 'Basket weave', maxDepth: 3, gen: basket },
  hex: { family: 'surface', label: 'Honeycomb', maxDepth: 3, gen: hex },
  trinet: { family: 'surface', label: 'Triangular net', maxDepth: 5, gen: trinet },
  nested: { family: 'surface', label: 'Nested boxes', maxDepth: 3, gen: nested },
  dots: { family: 'surface', label: 'Dot grid', maxDepth: 3, gen: dots },
};

const byKind = <T>(f: (k: Kind) => T): Readonly<Record<Kind, T>> => Object.fromEntries(KINDS.map((k) => [k, f(k)])) as Record<Kind, T>;

export const KIND_LABELS: Readonly<Record<Kind, string>> = byKind((k) => PATTERNS[k].label);
export const KIND_FAMILY: Readonly<Record<Kind, Family>> = byKind((k) => PATTERNS[k].family);
export const MAX_DEPTH: Readonly<Record<Kind, number>> = byKind((k) => PATTERNS[k].maxDepth);

export interface PatternParams {
  readonly kind: Kind;
  readonly seed: number;
  readonly depth: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly precision: number;
  readonly color: string;
  readonly opacity: number;
}

export function geometry(p: Pick<PatternParams, 'kind' | 'seed' | 'depth' | 'size'>): readonly (readonly Pt[])[] {
  const depth = Math.min(MAX_DEPTH[p.kind], Math.max(1, Math.floor(p.depth) || 1));
  return PATTERNS[p.kind].gen(mulberry32(p.seed), depth, p.size);
}

function num(n: number, precision: number): string {
  let s = n.toFixed(precision);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// Relative path data from rounded absolute points: h/v for axis moves, z for closed polylines.
function pathData(polys: readonly (readonly Pt[])[], precision: number): string {
  const f = 10 ** precision;
  const r = (v: number) => Math.round(v * f) / f;
  const cmd = (c: string, ...ns: number[]) =>
    ns.reduce((acc, n, i) => {
      const s = num(n, precision);
      return acc + (i > 0 && !s.startsWith('-') ? ' ' : '') + s;
    }, c);
  let d = '';
  for (const poly of polys) {
    const pts = poly.map(([x, y]) => [r(x), r(y)] as const);
    const [first] = pts;
    if (!first) continue;
    let seg = '';
    let [px, py] = first;
    for (const [x, y] of pts.slice(1)) {
      const dx = r(x - px);
      const dy = r(y - py);
      if (dx === 0 && dy === 0) continue;
      seg += dy === 0 ? cmd('h', dx) : dx === 0 ? cmd('v', dy) : cmd('l', dx, dy);
      px = x;
      py = y;
    }
    if (!seg) continue;
    const last = pts[pts.length - 1];
    if (pts.length > 3 && last && last[0] === first[0] && last[1] === first[1]) seg = seg.replace(/[hvl][^hvl]*$/, 'z');
    d += cmd('M', first[0], first[1]) + seg;
  }
  return d;
}

export function generate(p: PatternParams): string {
  const d = pathData(geometry(p), p.precision);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${p.size}" height="${p.size}" viewBox="0 0 ${p.size} ${p.size}">` +
    `<path d="${d}" fill="none" stroke="${p.color}" stroke-width="${p.strokeWidth}" stroke-opacity="${p.opacity}" stroke-linecap="round"/></svg>`
  );
}
