// A super tile: a 4 x 4 grid of cells that shows 4 seeded variants of one kind, each defined once
// in <defs> and placed with <use>. Only kinds whose edges agree between seeds can vary. Pure.
import { generate, geometry, type Kind } from './fractal.ts';
import { arrange } from './motifgrid.ts';
import { mulberry32 } from './patterns/util.ts';
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
const ORIENTATION_KINDS: readonly Kind[] = ['carpet', 'tree', 'fold', 'htree', 'stitch', 'whirl', 'koch'];
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
}

const VALID = ['2,2', '4,4', '6,4', '6,6'];

export const safeColor = (c: string): string => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

function parts(o: SuperTileOptions) {
  if (!canVary(o.kind)) throw new RangeError(`kind "${o.kind}" cannot vary: its edges differ between seeds`);
  const n = o.cells ?? SUPER_CELLS;
  const count = o.count ?? VARIANTS;
  if (!VALID.includes(`${n},${count}`)) throw new RangeError(`cells ${n} with ${count} variants is not supported`);
  const s = n * o.size;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`;
  const g = `<g fill="none" stroke="${safeColor(o.color)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.opacity}" stroke-linecap="round">`;
  const ds = variantSeeds(o.seed, count).map((seed) =>
    pathData(geometry({ kind: o.kind, seed, depth: o.depth, size: o.size, compat: true }), o.precision),
  );
  const map = n === SUPER_CELLS && count === VARIANTS ? null : arrange(count, n, o.seed);
  const cells: { v: number; x: number; y: number; t: string }[] = [];
  const orient = o.orient === true && ORIENTATION_KINDS.includes(o.kind);
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
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = map ? (map[r * n + c] ?? 0) : variantIndex(r, c);
      const x = c * o.size;
      const y = r * o.size;
      const k = seen[v]!++;
      const t = orient ? ` transform="${ORIENTATIONS[perms[v]![k % 8]!]!(x, y, o.size)}"` : tr(x, y);
      cells.push({ v, x, y, t });
    }
  return { head, g, ds, cells };
}

// The cell at 0 0 has no transform.
const tr = (x: number, y: number): string => (x === 0 && y === 0 ? '' : ` transform="translate(${x} ${y})"`);

export function superTileSvg(o: SuperTileOptions): string {
  const { head, g, ds, cells } = parts(o);
  const defs = ds.map((d, i) => `<path id="${IDS[i]}" d="${d}"/>`).join('');
  const uses = cells.map(({ v, t }) => `<use href="#${IDS[v]}"${t}/>`).join('');
  return `${head}<defs>${defs}</defs>${g}${uses}</g></svg>`;
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

export function superTileBytes(o: SuperTileOptions): { svg: number; expanded: number; plain: number } {
  const { head, g, ds, cells } = parts(o);
  const expanded = `${head}${g}${cells.map(({ v, t }) => `<path d="${ds[v]}"${t}/>`).join('')}</g></svg>`;
  return {
    svg: bytes(superTileSvg(o)),
    expanded: bytes(expanded),
    plain: bytes(generate({ ...o, color: safeColor(o.color), compat: true })),
  };
}
