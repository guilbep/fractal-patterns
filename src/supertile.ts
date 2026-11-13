// A super tile: a 4 x 4 grid of cells that shows 4 seeded variants of one kind, each defined once
// in <defs> and placed with <use>. Only kinds whose edges agree between seeds can vary. Pure.
import { generate, geometry, type Kind } from './fractal.ts';
import { arrange } from './motifgrid.ts';
import { mulberry32, type Pt } from './patterns/util.ts';
import { pathData } from './scene.ts';

export const VARIANT_KINDS: readonly Kind[] = [
  'carpet',
  'tree',
  'fold',
  'htree',
  'stitch',
  'whirl',
  'koch',
  'quadtree',
  'sierpinski',
  'brick',
  'stack',
  'herringbone',
  'basket',
  'hex',
  'trinet',
  'nested',
  'dots',
  'hatch',
  'crosshatch',
  'zigzag',
  'scales',
  'waves',
];
export const canVary = (kind: Kind): boolean => VARIANT_KINDS.includes(kind);

export const VARIANTS = 4;
export const SUPER_CELLS = 4;
const IDS = 'abcdef';

// No two horizontal or vertical neighbors are equal, also across the tile edge.
export const variantIndex = (row: number, column: number): number => (((2 * row + column) % 4) + 4) % 4;

// ponytail: seed + i with a 32-bit wrap; mulberry32 already scrambles neighboring seeds.
export const variantSeeds = (seed: number, count: number = VARIANTS): number[] => Array.from({ length: count }, (_, i) => (seed + i) >>> 0);

// The 8 symmetries of the square for a cell of edge s at (x, y); the content stays in its cell.
// Index 0 is the identity.
export const ORIENTATIONS: readonly ((x: number, y: number, s: number) => string)[] = [
  (x, y) => `translate(${x} ${y})`,
  (x, y, s) => `translate(${x + s} ${y}) rotate(90)`,
  (x, y, s) => `translate(${x + s} ${y + s}) rotate(180)`,
  (x, y, s) => `translate(${x} ${y + s}) rotate(270)`,
  (x, y, s) => `translate(${x + s} ${y}) scale(-1 1)`,
  (x, y, s) => `translate(${x} ${y + s}) scale(1 -1)`,
  (x, y) => `translate(${x} ${y}) rotate(90) scale(1 -1)`,
  (x, y, s) => `translate(${x + s} ${y + s}) rotate(90) scale(-1 1)`,
];

// Measured (src/repetition.ts measureOrientationKinds, pinned by its test): kinds whose boundary is
// the same on all 4 edges and symmetric along the edge, so any cell may be turned or flipped.
const ORIENTATION_KINDS: readonly Kind[] = ['carpet', 'tree', 'fold', 'htree', 'stitch', 'whirl', 'koch', 'dots'];
export const orientationKinds = (): readonly Kind[] => ORIENTATION_KINDS;

export interface SuperTileOptions {
  readonly kind: Kind;
  readonly seed: number;
  readonly depth: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly precision: number;
  readonly color: string;
  readonly opacity: number;
  readonly orient?: boolean;
  readonly cells?: 2 | 4 | 6;
  readonly count?: 2 | 4 | 6;
  // Per-cell options, each off when absent or neutral (see the measured lists below).
  readonly weights?: number; // 0..1: seeded stroke width and opacity per cell, any VARIANT_KINDS kind
  readonly skip?: number; // 0..0.5: share of empty cells, never neighbors, ORIENTATION_KINDS only
  readonly jitter?: number; // 0..1: seeded scale and shift inside the cell margin, MARGIN_KINDS only
  readonly depths?: boolean; // half of the variants at depth - 1, DEPTH_MIX_KINDS only
  readonly drop?: 'none' | 'half-drop' | 'brick'; // MARGIN_KINDS only
  readonly shift?: 2 | 3 | 4; // the offset is 1/shift of a cell per column (or row), default 2 (half)
}

// The shifts 1/q whose offsets repeat within the grid: q divides cells. 2/5 needs a 5 or 10 grid, none is offered.
export const shiftsFor = (cells: number): (2 | 3 | 4)[] => ([2, 3, 4] as const).filter((q) => cells % q === 0);

// Measured (src/repetition.ts measureMarginKinds, pinned by its test): kinds whose geometry stays at
// least MIN_MARGIN px inside the cell for seeds 1..4 at depth 2 and MAX_DEPTH, size 60.
export const MIN_MARGIN = 0.5;
export const MARGIN_KINDS: readonly Kind[] = ['carpet', 'tree', 'fold', 'htree', 'stitch', 'whirl'];
// Measured (src/repetition.ts measureDepthMixKinds, pinned by its test): ORIENTATION_KINDS kinds whose
// boundary signature is the same at depth d and d - 1, for every d from 2 to MAX_DEPTH, seeds 1..4.
export const DEPTH_MIX_KINDS: readonly Kind[] = ['carpet', 'tree', 'fold', 'htree', 'stitch', 'whirl', 'dots'];

type Geo = readonly (readonly Pt[])[];
const marginOf = (geos: readonly Geo[], size: number): number => {
  let m = Infinity;
  for (const geo of geos) for (const poly of geo) for (const [x, y] of poly) m = Math.min(m, x, size - x, y, size - y);
  return m;
};
// The smallest distance from any point of the variants' geometry to the cell border.
export const cellMargin = (kind: Kind, seed: number, depth: number, size: number, count: number): number =>
  marginOf(
    variantSeeds(seed, count).map((s) => geometry({ kind, seed: s, depth, size, compat: true })),
    size,
  );

const round = (v: number, p: number): number => Number(v.toFixed(p));
const TAU = 2 * Math.PI;
// A smooth periodic field over the n x n grid in [-1, 1]: two seeded sines over column and row.
const field = (rnd: () => number, n: number) => {
  const [a, b] = [rnd() * TAU, rnd() * TAU];
  return (r: number, c: number): number => (Math.sin((TAU * c) / n + a) + Math.sin((TAU * r) / n + b)) / 2;
};
// Seeded empty cells: a shuffled scan that takes a cell when no neighbor (with wrap) is taken.
function emptyCells(n: number, skip: number, seed: number): Set<number> {
  const max = Math.floor(n * n * skip);
  const rnd = mulberry32((seed * 7919 + 13) >>> 0);
  const order = Array.from({ length: n * n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const out = new Set<number>();
  for (const i of order) {
    if (out.size >= max) break;
    const [r, c] = [Math.floor(i / n), i % n];
    const nb = [((r + n - 1) % n) * n + c, ((r + 1) % n) * n + c, r * n + ((c + n - 1) % n), r * n + ((c + 1) % n)];
    if (!nb.some((k) => out.has(k))) out.add(i);
  }
  return out;
}

const VALID = ['2,2', '4,4', '6,4', '6,6'];

export const safeColor = (c: string): string => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

// The grid options shared by a math kind and a traced image.
export type GridOptions = Pick<
  SuperTileOptions,
  | 'seed'
  | 'size'
  | 'strokeWidth'
  | 'precision'
  | 'color'
  | 'opacity'
  | 'orient'
  | 'cells'
  | 'jitter'
  | 'weights'
  | 'skip'
  | 'drop'
  | 'shift'
>;
// What fills the cells: one geometry per variant in a cell of edge o.size, the variant of each cell,
// and which per-cell options apply. `shift` allows jitter and offset inside `margin`.
interface CellSource {
  readonly geos: readonly Geo[];
  readonly variantAt: (r: number, c: number) => number;
  readonly orient: boolean;
  readonly skip: boolean;
  readonly shift: boolean;
  readonly margin: number;
}

function parts(o: SuperTileOptions) {
  if (!canVary(o.kind)) throw new RangeError(`kind "${o.kind}" cannot vary: its edges differ between seeds`);
  const n = o.cells ?? SUPER_CELLS;
  const count = o.count ?? VARIANTS;
  if (!VALID.includes(`${n},${count}`)) throw new RangeError(`cells ${n} with ${count} variants is not supported`);
  const S = o.size;
  const lower = o.depths === true && DEPTH_MIX_KINDS.includes(o.kind);
  // Variants 1, 2, 5 take depth - 1: with variantIndex, odd variants alone would fill whole columns.
  const geos = variantSeeds(o.seed, count).map((seed, v) =>
    geometry({ kind: o.kind, seed, depth: lower && (v + 1) % 4 >= 2 ? Math.max(1, o.depth - 1) : o.depth, size: S, compat: true }),
  );
  const map = n === SUPER_CELLS && count === VARIANTS ? null : arrange(count, n, o.seed);
  const jitter = Math.min(1, Math.max(0, o.jitter ?? 0));
  const margin = (jitter > 0 || (o.drop ?? 'none') !== 'none') && MARGIN_KINDS.includes(o.kind) ? marginOf(geos, S) : 0;
  return grid(o, {
    geos,
    variantAt: (r, c) => (map ? (map[r * n + c] ?? 0) : variantIndex(r, c)),
    orient: o.orient === true && ORIENTATION_KINDS.includes(o.kind),
    skip: ORIENTATION_KINDS.includes(o.kind),
    shift: margin >= MIN_MARGIN,
    margin,
  });
}

// One traced picture in every cell: no edge agrees, so every per-cell option applies; the seams it
// shows are the picture's own. The polylines sit in a cell of edge o.size.
const imageParts = (o: GridOptions, polys: Geo) =>
  grid(o, {
    geos: [polys],
    variantAt: () => 0,
    orient: o.orient === true,
    skip: true,
    shift: true,
    margin: Math.max(0, marginOf([polys], o.size)),
  });

function grid(o: GridOptions, src: CellSource) {
  const n = o.cells ?? SUPER_CELLS;
  const count = src.geos.length;
  const s = n * o.size;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`;
  const g = `<g fill="none" stroke="${safeColor(o.color)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.opacity}" stroke-linecap="round">`;
  const S = o.size;
  const ds = src.geos.map((geo) => pathData(geo, o.precision));
  const cells: { v: number; x: number; y: number; t: string }[] = [];
  const orient = src.orient;
  const jitter = Math.min(1, Math.max(0, o.jitter ?? 0));
  const drop = o.drop ?? 'none';
  const margin = src.margin;
  const shake = src.shift && jitter > 0;
  const shift = src.shift ? drop : 'none';
  const q = shiftsFor(n).includes(o.shift ?? 2) ? (o.shift ?? 2) : 2;
  const skip = Math.min(0.5, Math.max(0, o.skip ?? 0));
  const empty = skip > 0 && src.skip ? emptyCells(n, skip, o.seed) : new Set<number>();
  const weights = Math.min(1, Math.max(0, o.weights ?? 0));
  const wf = weights > 0 ? field(mulberry32((o.seed * 131 + 7) >>> 0), n) : null;
  const of = weights > 0 ? field(mulberry32((o.seed * 137 + 11) >>> 0), n) : null;
  const jrnd = mulberry32((o.seed * 7 + 3) >>> 0);
  const u = 0.5 * 10 ** -o.precision + 1e-9;
  // Per variant, a seeded order of the 8 orientations: the k-th cell of a variant (row-major) takes
  // the k-th one, so up to 8 cells of one variant never share an orientation.
  const perms = Array.from({ length: count }, (_, v) => {
    const rnd = mulberry32((o.seed * 31 + v) >>> 0);
    const p = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let i = 7; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [p[i], p[j]] = [p[j]!, p[i]!];
    }
    return p;
  });
  const seen = Array<number>(count).fill(0);
  const T = n * S;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = src.variantAt(r, c);
      const k = seen[v]!++;
      // Jitter: scale k about the cell origin, then a shift around the centered position, inside the margin.
      let jit = '';
      if (shake) {
        const sc = round(1 - 0.15 * jitter * jrnd(), 2);
        const lo = -sc * margin + u;
        const hi = S - sc * (S - margin) - u;
        const mid = (S * (1 - sc)) / 2;
        const off = () => (lo > hi ? 0 : round(Math.min(hi, Math.max(lo, mid + jitter * (2 * jrnd() - 1) * ((hi - lo) / 2))), o.precision));
        const [dx, dy] = [off(), off()];
        jit = [dx || dy ? `translate(${dx} ${dy})` : '', sc !== 1 ? `scale(${sc})` : ''].filter(Boolean).join(' ');
      }
      if (empty.has(r * n + c)) continue;
      let w = '';
      if (wf && of) {
        const sw = round(o.strokeWidth * (1 + 0.5 * weights * wf(r, c)), 2);
        const so = round(o.opacity * (1 - 0.4 * weights * ((1 - of(r, c)) / 2)), 2);
        if (sw !== o.strokeWidth) w += ` stroke-width="${sw}"`;
        if (so !== o.opacity && so <= o.opacity) w += ` stroke-opacity="${so}"`;
      }
      // Column c (row r for brick) moves by (c mod q) / q of a cell; q = 2 gives the half-cell offset.
      const x0 = c * S + (shift === 'brick' && r % q !== 0 ? ((r % q) * S) / q : 0);
      const y0 = r * S + (shift === 'half-drop' && c % q !== 0 ? ((c % q) * S) / q : 0);
      // A shifted cell that crosses the super tile edge is drawn again one period back.
      const places: [number, number][] = [[x0, y0]];
      if (x0 + S > T) places.push([x0 - T, y0]);
      if (y0 + S > T) places.push([x0, y0 - T]);
      for (const [x, y] of places) {
        const base = orient ? ORIENTATIONS[perms[v]![k % 8]!]!(x, y, S) : x === 0 && y === 0 ? '' : `translate(${x} ${y})`;
        const all = [base, jit].filter(Boolean).join(' ');
        cells.push({ v, x, y, t: (all ? ` transform="${all}"` : '') + w });
      }
    }
  return { head, g, ds, cells };
}

type Parts = ReturnType<typeof grid>;
const render = ({ head, g, ds, cells }: Parts): string => {
  const defs = ds.map((d, i) => `<path id="${IDS[i]}" d="${d}"/>`).join('');
  const uses = cells.map(({ v, t }) => `<use href="#${IDS[v]}"${t}/>`).join('');
  return `${head}<defs>${defs}</defs>${g}${uses}</g></svg>`;
};
// The same tile with every cell a copy of its path: what the <use> structure saves.
const expand = ({ head, g, ds, cells }: Parts): string =>
  `${head}${g}${cells.map(({ v, t }) => `<path d="${ds[v]}"${t}/>`).join('')}</g></svg>`;

export const superTileSvg = (o: SuperTileOptions): string => render(parts(o));

const bytes = (s: string): number => new TextEncoder().encode(s).length;

export function superTileBytes(o: SuperTileOptions): { svg: number; expanded: number; plain: number } {
  const p = parts(o);
  return {
    svg: bytes(render(p)),
    expanded: bytes(expand(p)),
    plain: bytes(generate({ ...o, color: safeColor(o.color), compat: true })),
  };
}

// A super tile of one traced picture: the path is written once and placed in every cell with <use>.
export const imageSuperTileSvg = (o: GridOptions, polys: Geo): string => render(imageParts(o, polys));
export const imageSuperTileExpanded = (o: GridOptions, polys: Geo): string => expand(imageParts(o, polys));
