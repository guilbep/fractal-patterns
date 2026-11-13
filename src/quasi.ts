// Repeating 8-fold (Ammann-Beenker) and 12-fold quasicrystal tiles: periodic approximants by the
// generalized dual method, as `approximant` in penrose.ts. Grid lines use rational normals
// (sqrt 2 or sqrt 3 replaced by a convergent p / q), tile vertices use the true star vectors,
// so the rhombs are exact and the tiling repeats on the square V1 x V2.
import { torusEdgeKey } from './penrose.ts';
import { mulberry32, wrap, type Generator, type Poly, type Pt, type Rng } from './patterns/util.ts';

export interface Tile {
  readonly points: readonly [Pt, Pt, Pt, Pt];
  // The rhomb's acute (or right) angle in degrees.
  readonly angle: number;
}

export type Fold = 8 | 12;

// Convergents p / q of sqrt 2 (8-fold) and sqrt 3 (12-fold), by level 1..4.
export const CONVERGENTS: Record<Fold, readonly (readonly [number, number])[]> = {
  8: [
    [3, 2],
    [7, 5],
    [17, 12],
    [41, 29],
  ],
  12: [
    [2, 1],
    [5, 3],
    [7, 4],
    [19, 11],
  ],
};

// Star vectors: N = fold / 2 directions spaced 180 / N degrees.
const star = (fold: Fold): Pt[] =>
  Array.from({ length: fold / 2 }, (_, j): Pt => [Math.cos((2 * Math.PI * j) / fold), Math.sin((2 * Math.PI * j) / fold)]);

// Rational grid normals for t = p / q (t stands for sqrt 2 or sqrt 3): periodic under (2q, 0) and (0, 2q).
export function quasiNormals(fold: Fold, p: number, q: number): Pt[] {
  const c = p / (2 * q);
  return fold === 8
    ? [
        [1, 0],
        [c, c],
        [0, 1],
        [-c, c],
      ]
    : [
        [1, 0],
        [c, 0.5],
        [0.5, c],
        [0, 1],
        [-0.5, c],
        [-c, 0.5],
      ];
}

const mod = (v: number, m: number) => v - Math.floor(v / m) * m;

interface Crossing {
  readonly j: number;
  readonly l: number;
  readonly kj: number;
  readonly kl: number;
  readonly x: number;
  readonly y: number;
}

// All crossings in the half-open cell [0, cw) x [0, cw).
function crossings(G: Pt[], g: number[], cw: number): Crossing[] {
  const corners: Pt[] = [
    [0, 0],
    [cw, 0],
    [0, cw],
    [cw, cw],
  ];
  const range = (m: number) => {
    const v = corners.map(([x, y]) => x * G[m]![0] + y * G[m]![1] + g[m]!);
    return [Math.floor(Math.min(...v)), Math.ceil(Math.max(...v))] as const;
  };
  const out: Crossing[] = [];
  for (let j = 0; j < G.length; j++) {
    for (let l = j + 1; l < G.length; l++) {
      const [ajx, ajy] = G[j]!;
      const [alx, aly] = G[l]!;
      const det = ajx * aly - ajy * alx;
      const [j0, j1] = range(j);
      const [l0, l1] = range(l);
      for (let kj = j0; kj <= j1; kj++) {
        for (let kl = l0; kl <= l1; kl++) {
          const bj = kj - g[j]!;
          const bl = kl - g[l]!;
          const x = (bj * aly - bl * ajy) / det;
          const y = (ajx * bl - alx * bj) / det;
          if (x >= 0 && x < cw && y >= 0 && y < cw) out.push({ j, l, kj, kl, x, y });
        }
      }
    }
  }
  return out;
}

// Two crossings at one point mean three lines through it (a triple point): the dual breaks there.
function hasTriple(cs: Crossing[]): boolean {
  const s = [...cs].sort((a, b) => a.x - b.x);
  for (let i = 0; i < s.length; i++)
    for (let k = i + 1; k < s.length && s[k]!.x - s[i]!.x < 1e-9; k++) if (Math.abs(s[k]!.y - s[i]!.y) < 1e-9) return true;
  return false;
}

export function quasiApproximant(fold: Fold, seed: number, level: number): { tiles: Tile[]; width: number; height: number } {
  const [p, q] = CONVERGENTS[fold][level - 1]!;
  const G = quasiNormals(fold, p, q);
  const E = star(fold);
  const cw = 2 * q;
  const n1 = G.map(([x]) => Math.round(x * cw));
  const n2 = G.map(([, y]) => Math.round(y * cw));
  const width = n1.reduce((s, n, m) => s + n * E[m]![0], 0);
  const height = n2.reduce((s, n, m) => s + n * E[m]![1], 0);
  const rnd = mulberry32(seed);
  let g: number[] = [];
  let cs: Crossing[] = [];
  for (let tries = 0; ; tries++) {
    if (tries === 20) throw new Error(`quasiApproximant: triple points after 20 draws (fold ${fold}, seed ${seed})`);
    g = G.map(() => 0.05 + 0.9 * rnd());
    cs = crossings(G, g, cw);
    if (!hasTriple(cs)) break;
  }
  const tiles = cs.map(({ j, l, kj, kl, x: px, y: py }): Tile => {
    const K = G.map(([gx, gy], m) => (m === j ? kj : m === l ? kl : Math.ceil(px * gx + py * gy + g[m]!)));
    let x = 0,
      y = 0;
    K.forEach((k, m) => {
      x += k * E[m]![0];
      y += k * E[m]![1];
    });
    const [ex, ey] = E[j]!;
    const [fx, fy] = E[l]!;
    // Reduce by the centre into the cell.
    x += mod(x + (ex + fx) / 2, width) - (x + (ex + fx) / 2);
    y += mod(y + (ey + fy) / 2, height) - (y + (ey + fy) / 2);
    const d = ((l - j) * 360) / fold;
    return {
      points: [
        [x, y],
        [x + ex, y + ey],
        [x + ex + fx, y + ey + fy],
        [x + fx, y + fy],
      ],
      angle: Math.min(d, 180 - d),
    };
  });
  return { tiles, width, height };
}

// Strapwork: the quadrilateral through the 4 edge midpoints, closed.
export function midQuad({ points: P }: Tile): Poly {
  const m = (i: number): Pt => [(P[i]![0] + P[(i + 1) % 4]![0]) / 2, (P[i]![1] + P[(i + 1) % 4]![1]) / 2];
  return [m(0), m(1), m(2), m(3), m(0)];
}

// ponytail: a transcendental shift keeps tile edges off the tile border (a border segment breaks the seam).
const OFF: Pt = [Math.PI / 10, Math.E / 10];

export const QUASI_MAX_DEPTH = 3;
const aspect = (fold: Fold) => ((a) => a.width / a.height)(quasiApproximant(fold, 1, 1));
export const QUASI_ASPECT: { 8: number; 12: number } = { 8: aspect(8), 12: aspect(12) };

// Repeating tile: approximant at level = depth, scaled to width `size`; the cell is square
// (aspect 1 up to rounding), so the square-only wrap() applies directly.
// `stars` draws the midpoint quadrilaterals instead of the edges.
export function quasiTile(fold: Fold, rnd: Rng, depth: number, size: number, decorate: 'edges' | 'stars'): Poly[] {
  const seed = Math.floor(rnd() * 2 ** 32);
  const { tiles, width: W, height: H } = quasiApproximant(fold, seed, Math.min(Math.max(depth, 1), QUASI_MAX_DEPTH));
  let polys: Poly[];
  if (decorate === 'edges') {
    // Each torus edge once: reduce by its midpoint before deduplication.
    const seen = new Map<string, Poly>();
    for (const { points } of tiles)
      for (let i = 0; i < 4; i++) {
        const p = points[i]!;
        const q = points[(i + 1) % 4]!;
        const dx = mod((p[0] + q[0]) / 2, W) - (p[0] + q[0]) / 2;
        const dy = mod((p[1] + q[1]) / 2, H) - (p[1] + q[1]) / 2;
        seen.set(torusEdgeKey(p, q, W, H), [
          [p[0] + dx, p[1] + dy],
          [q[0] + dx, q[1] + dy],
        ]);
      }
    polys = [...seen.values()];
  } else polys = tiles.map(midQuad);
  return wrap(
    polys.map((poly) => poly.map(([x, y]): Pt => [((x + OFF[0]) * size) / W, ((y + OFF[1]) * size) / H])),
    size,
  );
}

const gen =
  (fold: Fold, decorate: 'edges' | 'stars'): Generator =>
  (rnd, depth, size) =>
    quasiTile(fold, rnd, depth, size, decorate);
export const octaEdges = gen(8, 'edges');
export const octaStars = gen(8, 'stars');
export const dodecaEdges = gen(12, 'edges');
export const dodecaStars = gen(12, 'stars');
