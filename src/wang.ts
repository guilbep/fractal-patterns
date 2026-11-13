// Experimental Wang tiles: 16 square tiles with 0/1 edge codes, laid out on a torus so that every
// shared edge matches, then written as <defs> + one <use> per cell (the period is cells * size).
import { mulberry32, type Poly, type Pt } from './patterns/util.ts';
import { pathData } from './scene.ts';
import { safeColor } from './supertile.ts';

export type Edges = readonly [top: number, right: number, bottom: number, left: number];

// index = top + 2 * right + 4 * bottom + 8 * left
export const TILES: readonly Edges[] = Array.from({ length: 16 }, (_, i): Edges => [i & 1, (i >> 1) & 1, (i >> 2) & 1, (i >> 3) & 1]);

const tileIndex = (e: Edges): number => e[0] + 2 * e[1] + 4 * e[2] + 8 * e[3];

// Edge codes first (each a seeded bit), tiles second: every layout is valid, including across the wrap.
export function wangLayout(cells: number, seed: number, density = 0.5): number[] {
  const rnd = mulberry32(seed);
  const bits = (): number[] => Array.from({ length: cells * cells }, () => (rnd() < density ? 1 : 0));
  const v = bits(); // v[r * n + c]: the vertical edge on the left of cell (r, c)
  const h = bits(); // h[r * n + c]: the horizontal edge on top of cell (r, c)
  const n = cells;
  const out: number[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) out.push(tileIndex([h[r * n + c]!, v[r * n + ((c + 1) % n)]!, h[((r + 1) % n) * n + c]!, v[r * n + c]!]));
  return out;
}

export type WangStyle = 'pipes' | 'weave' | 'paths' | 'maze' | 'rail';

/** Half the distance between the two strokes of a weave ribbon, as a fraction of the cell (18 % apart). */
export const WEAVE_HALF = 0.09;

const ARC_STEPS = 8;
const CIRCLE_STEPS = 16;

// Quarter turn clockwise on screen around the cell centre: top -> right -> bottom -> left.
const turn = (polys: Poly[], k: number, s: number): Poly[] => {
  let out = polys;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) out = out.map((p) => p.map(([x, y]): Pt => [s - y, x]));
  return out;
};

// Quarter arc of radius r around the top-right corner, from the top edge to the right edge (exact ends).
const arc = (r: number, s: number): Poly =>
  Array.from({ length: ARC_STEPS + 1 }, (_, i): Pt => {
    if (i === 0) return [s - r, 0];
    if (i === ARC_STEPS) return [s, r];
    const a = (i / ARC_STEPS) * (Math.PI / 2);
    return [s - r * Math.cos(a), r * Math.sin(a)];
  });

const circle = (cx: number, cy: number, r: number): Poly =>
  Array.from({ length: CIRCLE_STEPS + 1 }, (_, i): Pt => {
    const a = ((i % CIRCLE_STEPS) / CIRCLE_STEPS) * 2 * Math.PI;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

// The x offsets of the strokes of one line: one stroke for pipes, two for a weave ribbon or a rail track.
const lanes = (style: WangStyle, s: number): number[] => (style === 'weave' || style === 'rail' ? [-WEAVE_HALF * s, WEAVE_HALF * s] : [0]);

// Top to bottom; with a gap, broken around the centre (the "under" strand of a crossing).
function straight(style: WangStyle, s: number, gap: boolean): Poly[] {
  const c = s / 2;
  const g = gap ? (style === 'weave' ? 2 * WEAVE_HALF * s : 0.12 * s) : 0;
  return lanes(style, s).flatMap((o): Poly[] =>
    gap
      ? [
          [
            [c + o, 0],
            [c + o, c - g],
          ],
          [
            [c + o, c + g],
            [c + o, s],
          ],
        ]
      : [
          [
            [c + o, 0],
            [c + o, s],
          ],
        ],
  );
}

const arcs = (style: WangStyle, s: number): Poly[] => lanes(style, s).map((o) => arc(s / 2 - o, s));

// From the top edge to an end near the centre: a small cap for pipes, a rounded end for a ribbon.
function stub(style: WangStyle, s: number): Poly[] {
  const c = s / 2;
  if (style === 'weave') {
    const d = WEAVE_HALF * s;
    const end = Array.from({ length: ARC_STEPS + 1 }, (_, i): Pt => {
      const a = Math.PI * (1 - i / ARC_STEPS);
      return [c + d * Math.cos(a), c + d * Math.sin(a)];
    });
    return [[[c - d, 0], ...end, [c + d, 0]]];
  }
  const r = 0.08 * s;
  return [
    [
      [c, 0],
      [c, c - r],
    ],
    circle(c, c, r),
  ];
}

// Rail: half gauge WEAVE_HALF, sleepers reach SLEEPER times as far from the track centre.
const SLEEPER = 1.4;

// A sleeper across a top-to-bottom track at height y.
const sleeper = (y: number, s: number): Poly => [
  [s / 2 - SLEEPER * WEAVE_HALF * s, y],
  [s / 2 + SLEEPER * WEAVE_HALF * s, y],
];

// Track pieces: rails cross a coded edge at middle +- WEAVE_HALF; no sleeper comes closer than s / 8 to the border.
function railTile(edges: Edges, variant: number, s: number): Poly[] {
  const c = s / 2;
  const d = WEAVE_HALF * s;
  const on = [0, 1, 2, 3].filter((e) => edges[e] === 1);
  // Top to bottom, sleepers at the given fractions of the cell.
  const track = (at: number[]): Poly[] => [...straight('rail', s, false), ...at.map((f) => sleeper(f * s, s))];
  // Top to right around the top-right corner, three radial sleepers (the first 15 degrees, 0.13 s of arc, in).
  const curve = (): Poly[] => [
    ...arcs('rail', s),
    ...[1, 3, 5].map((k): Poly => {
      const a = (k / 6) * (Math.PI / 2);
      return [c - SLEEPER * d, c + SLEEPER * d].map((r): Pt => [s - r * Math.cos(a), r * Math.sin(a)]);
    }),
  ];
  const QUARTERS = [1 / 8, 3 / 8, 5 / 8, 7 / 8];
  switch (on.length) {
    case 0:
      return [];
    case 1: {
      // Buffer stop: rails to the centre, a bar across them.
      const end: Poly[] = [
        [
          [c - d, 0],
          [c - d, c],
        ],
        [
          [c + d, 0],
          [c + d, c],
        ],
        sleeper(c, s),
        sleeper(s / 8, s),
        sleeper((3 * s) / 8, s),
      ];
      return turn(end, on[0]!, s);
    }
    case 2: {
      const [a, b] = [on[0]!, on[1]!];
      if (b - a === 2) return turn(track(QUARTERS), a, s);
      return turn(curve(), b - a === 1 ? a : 3, s);
    }
    case 3: {
      const m = [0, 1, 2, 3].find((e) => edges[e] === 0)!;
      return [...turn(track(QUARTERS), m + 1, s), ...turn(curve(), variant % 2 === 1 ? m + 2 : m + 1, s)];
    }
    default: {
      // Level crossing: sleepers stop short of the crossing square and of each other.
      const at = [1 / 8, 0.3, 0.7, 7 / 8];
      return [...track(at), ...turn(track(at), 1, s)];
    }
  }
}

/**
 * The content of one tile in 0..size: lines meet the edges coded 1 at their midpoints (weave and rail: at +-WEAVE_HALF * size).
 * crossGap: false draws a four-way crossing as a plain join (no over and under gap).
 */
export function tileGeometry(style: WangStyle, edges: Edges, variant: number, size: number, crossGap = true): Poly[] {
  const s = size;
  const c = s / 2;
  if (style === 'rail') return railTile(edges, variant, s);
  const on = [0, 1, 2, 3].filter((e) => edges[e] === 1);
  if (style === 'maze') {
    // Straight walls from the centre to each coded middle: a wall end, a line, a corner, a T or a cross.
    const mid: Pt[] = [
      [c, 0],
      [s, c],
      [c, s],
      [0, c],
    ];
    return on.map((e): Poly => [mid[e]!, [c, c]]);
  }
  if (style === 'paths') {
    const rnd = mulberry32((tileIndex(edges) * 977 + variant * 131 + 7) >>> 0);
    const p: Pt = [c + (rnd() - 0.5) * 0.24 * s, c + (rnd() - 0.5) * 0.24 * s];
    const mid: Pt[] = [
      [c, 0],
      [s, c],
      [c, s],
      [0, c],
    ];
    return on.map((e): Poly => [mid[e]!, p]);
  }
  const alt = variant % 2 === 1;
  switch (on.length) {
    case 0:
      return alt ? (style === 'weave' ? [circle(c, c, 0.25 * s), circle(c, c, 0.07 * s)] : [circle(c, c, 0.15 * s)]) : [];
    case 1:
      return turn(stub(style, s), on[0]!, s);
    case 2: {
      const [a, b] = [on[0]!, on[1]!];
      if (b - a === 2) return turn(straight(style, s, false), a, s);
      return turn(arcs(style, s), b - a === 1 ? a : 3, s); // adjacent pair {a, a+1}, or {3, 0}
    }
    case 3: {
      const m = [0, 1, 2, 3].find((e) => edges[e] === 0)!;
      return [...turn(straight(style, s, false), m + 1, s), ...turn(arcs(style, s), alt ? m + 2 : m + 1, s)];
    }
    default:
      return alt
        ? [...arcs(style, s), ...turn(arcs(style, s), 2, s)]
        : [...turn(straight(style, s, false), 1, s), ...straight(style, s, crossGap)];
  }
}

export interface WangOptions {
  readonly style: WangStyle;
  readonly cells: number;
  readonly seed: number;
  readonly size: number;
  readonly density: number;
  readonly strokeWidth: number;
  readonly precision: number;
  readonly color: string;
  readonly opacity: number;
}

const tr = (x: number, y: number): string => (x === 0 && y === 0 ? '' : ` transform="translate(${x} ${y})"`);

function parts(o: WangOptions) {
  if (!Number.isInteger(o.cells) || o.cells < 4 || o.cells > 16) throw new RangeError(`cells must be 4..16, got ${o.cells}`);
  const layout = wangLayout(o.cells, o.seed, o.density);
  // A seeded half of the tiles may take their second variant: at most 16 + 8 = 24 definitions.
  const rnd = mulberry32((o.seed * 2654435761 + 1) >>> 0);
  const order = Array.from({ length: 16 }, (_, i) => i);
  for (let i = 15; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const two = new Set(order.slice(0, 8));
  const ds = new Map<number, string>();
  const ids = new Map<number, string>();
  const cells: { key: number; t: string }[] = [];
  layout.forEach((tile, i) => {
    const key = 2 * tile + (two.has(tile) && rnd() < 0.5 ? 1 : 0);
    if (!ds.has(key)) ds.set(key, pathData(tileGeometry(o.style, TILES[tile]!, key % 2, o.size), o.precision));
    if (!ds.get(key)) return; // empty tile: no definition, no <use>
    if (!ids.has(key)) ids.set(key, String.fromCharCode(97 + ids.size));
    cells.push({ key, t: tr((i % o.cells) * o.size, Math.floor(i / o.cells) * o.size) });
  });
  const p = o.cells * o.size;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${p}" height="${p}" viewBox="0 0 ${p} ${p}">`;
  const g = `<g fill="none" stroke="${safeColor(o.color)}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.opacity}" stroke-linecap="round">`;
  return { head, g, ds, ids, cells };
}

export function wangSvg(o: WangOptions): string {
  const { head, g, ds, ids, cells } = parts(o);
  const defs = [...ids].map(([key, id]) => `<path id="${id}" d="${ds.get(key)}"/>`).join('');
  const uses = cells.map(({ key, t }) => `<use href="#${ids.get(key)}"${t}/>`).join('');
  return `${head}<defs>${defs}</defs>${g}${uses}</g></svg>`;
}

const bytes = (s: string): number => new TextEncoder().encode(s).length;

export function wangBytes(o: WangOptions): { svg: number; expanded: number; definitions: number; cells: number; period: number } {
  const { head, g, ds, ids, cells } = parts(o);
  const expanded = `${head}${g}${cells.map(({ key, t }) => `<path d="${ds.get(key)}"${t}/>`).join('')}</g></svg>`;
  return { svg: bytes(wangSvg(o)), expanded: bytes(expanded), definitions: ids.size, cells: cells.length, period: o.cells * o.size };
}
