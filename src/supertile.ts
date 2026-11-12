// A super tile: a 4 x 4 grid of cells that shows 4 seeded variants of one kind, each defined once
// in <defs> and placed with <use>. Only kinds whose edges agree between seeds can vary. Pure.
import { generate, geometry, type Kind } from './fractal.ts';
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
const IDS = ['a', 'b', 'c', 'd'] as const;

// No two horizontal or vertical neighbors are equal, also across the tile edge.
export const variantIndex = (row: number, column: number): number => (((2 * row + column) % 4) + 4) % 4;

// ponytail: seed + i with a 32-bit wrap; mulberry32 already scrambles neighboring seeds.
export const variantSeeds = (seed: number): number[] => Array.from({ length: VARIANTS }, (_, i) => (seed + i) >>> 0);

export interface SuperTileOptions {
  readonly kind: Kind;
  readonly seed: number;
  readonly depth: number;
  readonly size: number;
  readonly strokeWidth: number;
  readonly precision: number;
  readonly color: string;
  readonly opacity: number;
}

const safeColor = (c: string): string => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#000000');

function parts(o: SuperTileOptions) {
  if (!canVary(o.kind)) throw new RangeError(`kind "${o.kind}" cannot vary: its edges differ between seeds`);
  const s = SUPER_CELLS * o.size;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`;
  const g = `<g fill="none" stroke="${safeColor(o.color)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.opacity}" stroke-linecap="round">`;
  const ds = variantSeeds(o.seed).map((seed) => pathData(geometry({ kind: o.kind, seed, depth: o.depth, size: o.size }), o.precision));
  const cells: { v: number; x: number; y: number }[] = [];
  for (let r = 0; r < SUPER_CELLS; r++)
    for (let c = 0; c < SUPER_CELLS; c++) cells.push({ v: variantIndex(r, c), x: c * o.size, y: r * o.size });
  return { head, g, ds, cells };
}

// The cell at 0 0 has no transform.
const tr = (x: number, y: number): string => (x === 0 && y === 0 ? '' : ` transform="translate(${x} ${y})"`);

export function superTileSvg(o: SuperTileOptions): string {
  const { head, g, ds, cells } = parts(o);
  const defs = ds.map((d, i) => `<path id="${IDS[i]}" d="${d}"/>`).join('');
  const uses = cells.map(({ v, x, y }) => `<use href="#${IDS[v]}"${tr(x, y)}/>`).join('');
  return `${head}<defs>${defs}</defs>${g}${uses}</g></svg>`;
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

export function superTileBytes(o: SuperTileOptions): { svg: number; expanded: number; plain: number } {
  const { head, g, ds, cells } = parts(o);
  const expanded = `${head}${g}${cells.map(({ v, x, y }) => `<path d="${ds[v]}"${tr(x, y)}/>`).join('')}</g></svg>`;
  return {
    svg: bytes(superTileSvg(o)),
    expanded: bytes(expanded),
    plain: bytes(generate({ ...o, color: safeColor(o.color) })),
  };
}
