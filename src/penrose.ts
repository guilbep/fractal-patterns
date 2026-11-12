// Experimental Penrose rhomb tiling from de Bruijn's pentagrid (1981).
// A Penrose tiling has no period, so it cannot be a seamless CSS tile: this module draws a
// finite patch of the true tiling; `approximant` builds a periodic (Fibonacci) approximant for tiles.
import { fit, mulberry32, TAU, wrap, type Generator, type Poly, type Pt, type Rng } from './patterns/util.ts';
import { pathData } from './scene.ts';

export interface Rhomb {
  readonly points: readonly [Pt, Pt, Pt, Pt];
  readonly fat: boolean;
  // Pentagrid vertex index (sum of K_m) of points[0]; points[2] has index + 2.
  readonly index: number;
}

const E: Pt[] = [0, 1, 2, 3, 4].map((j): Pt => [Math.cos((TAU * j) / 5), Math.sin((TAU * j) / 5)]);

function gammas(seed: number): number[] {
  const rnd = mulberry32(seed);
  // ponytail: random offsets avoid triple points with probability 1; no explicit check.
  const g = [0, 1, 2, 3].map(() => 0.05 + 0.9 * rnd());
  return [...g, -g.reduce((a, b) => a + b, 0)];
}

export function penrosePatch(seed: number, radius: number): Rhomb[] {
  const g = gammas(seed);
  const out: Rhomb[] = [];
  for (let j = 0; j < 5; j++) {
    for (let l = j + 1; l < 5; l++) {
      const [ajx, ajy] = E[j]!;
      const [alx, aly] = E[l]!;
      const det = ajx * aly - ajy * alx;
      for (let kj = -radius; kj <= radius; kj++) {
        for (let kl = -radius; kl <= radius; kl++) {
          // Solve p.e_j = kj - g_j, p.e_l = kl - g_l.
          const bj = kj - g[j]!;
          const bl = kl - g[l]!;
          const p: Pt = [(bj * aly - bl * ajy) / det, (ajx * bl - alx * bj) / det];
          // Keep a disc of the grid, so the patch is round instead of five-pointed spikes.
          if (Math.hypot(p[0], p[1]) > radius) continue;
          const K = E.map(([ex, ey], m) => (m === j ? kj : m === l ? kl : Math.ceil(p[0] * ex + p[1] * ey + g[m]!)));
          let x = 0,
            y = 0;
          K.forEach((k, m) => {
            x += k * E[m]![0];
            y += k * E[m]![1];
          });
          const a: Pt = [x, y];
          const b: Pt = [x + ajx, y + ajy];
          const c: Pt = [x + ajx + alx, y + ajy + aly];
          const d: Pt = [x + alx, y + aly];
          const index = K.reduce((s, k) => s + k, 0);
          out.push({ points: [a, b, c, d], fat: l - j === 1 || l - j === 4, index });
        }
      }
    }
  }
  return out;
}

const key = ([x, y]: Pt) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;
export const edgeKey = (p: Pt, q: Pt) => [key(p), key(q)].sort().join('|');

// ponytail: 2-point segments only; joining collinear runs would shave bytes, add if size matters.
export function patchEdges(rhombs: readonly Rhomb[]): Poly[] {
  const seen = new Map<string, Poly>();
  for (const { points } of rhombs) {
    for (let i = 0; i < 4; i++) {
      const p = points[i]!;
      const q = points[(i + 1) % 4]!;
      const k = edgeKey(p, q);
      if (!seen.has(k)) seen.set(k, [p, q]);
    }
  }
  return [...seen.values()];
}

const lerp = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

// Matching-rule arcs: centred at points[0] and points[2] (the 72 degree corners of a fat
// rhomb, the 144 degree corners of a thin one); radius 1/4 or 3/4 of the edge by the
// centre's pentagrid index, so arcs of neighbouring tiles meet at shared edge points.
export function arcRadius(fat: boolean, centerIndex: number): number {
  // Found by exhaustive search over all 1/4-or-3/4 assignments, checked by the tests.
  const i = ((centerIndex % 5) + 5) % 5;
  return fat && (i === 2 || i === 3) ? 0.75 : 0.25;
}

export function rhombArcs(r: Rhomb, segments = 8): Poly[] {
  const [a, b, c, d] = r.points;
  const arc = (o: Pt, p: Pt, q: Pt, rad: number): Poly => {
    const s = lerp(o, p, rad);
    const t = lerp(o, q, rad);
    const a0 = Math.atan2(s[1] - o[1], s[0] - o[0]);
    let da = Math.atan2(t[1] - o[1], t[0] - o[0]) - a0;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    return Array.from({ length: segments + 1 }, (_, i): Pt => [
      o[0] + rad * Math.cos(a0 + (da * i) / segments),
      o[1] + rad * Math.sin(a0 + (da * i) / segments),
    ]);
  };
  return [arc(a, b, d, arcRadius(r.fat, r.index)), arc(c, b, d, arcRadius(r.fat, r.index + 2))];
}

export function patchSvg(
  rhombs: readonly Rhomb[],
  o: { size: number; strokeWidth: number; precision: number; color: string; opacity: number; decorate: 'edges' | 'arcs' | 'both' },
): string {
  const polys: Poly[] = [];
  if (o.decorate !== 'arcs') polys.push(...patchEdges(rhombs));
  if (o.decorate !== 'edges') polys.push(...rhombs.flatMap((r) => rhombArcs(r)));
  const d = pathData(fit(polys, o.size, 0.02), o.precision);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" viewBox="0 0 ${o.size} ${o.size}"><path d="${d}" fill="none" stroke="${o.color}" stroke-width="${o.strokeWidth}" stroke-opacity="${o.opacity}" stroke-linecap="round"/></svg>`;
}

const S72 = Math.sin(TAU / 5);
const FIB = [1, 1, 2, 3, 5, 8, 13, 21];

// Rational pentagrid normals for t = p / q: the grid is periodic under (2q, 0) and (0, p / s72).
export function gridNormals(p: number, q: number): Pt[] {
  const t = p / q;
  return [
    [1, 0],
    [(t - 1) / 2, S72],
    [-t / 2, S72 / t],
    [-t / 2, -S72 / t],
    [(t - 1) / 2, -S72],
  ];
}

const mod = (v: number, m: number) => v - Math.floor(v / m) * m;

// Periodic (Fibonacci) approximant by the generalized dual method: grid lines from the rational
// normals, tile vertices from the true star vectors. Rhombs are reduced into [0, width) x [0, height).
export function approximant(seed: number, level: number): { rhombs: Rhomb[]; width: number; height: number } {
  const p = FIB[level + 1]!;
  const q = FIB[level]!;
  const G = gridNormals(p, q);
  const g = gammas(seed);
  const cw = 2 * q;
  const ch = p / S72;
  const n1 = G.map(([x]) => Math.round(x * cw));
  const n2 = G.map(([, y]) => Math.round(y * ch));
  const width = n1.reduce((s, n, m) => s + n * E[m]![0], 0);
  const height = n2.reduce((s, n, m) => s + n * E[m]![1], 0);
  const corners: Pt[] = [
    [0, 0],
    [cw, 0],
    [0, ch],
    [cw, ch],
  ];
  const range = (m: number) => {
    const v = corners.map(([x, y]) => x * G[m]![0] + y * G[m]![1] + g[m]!);
    return [Math.floor(Math.min(...v)), Math.ceil(Math.max(...v))] as const;
  };
  const out: Rhomb[] = [];
  for (let j = 0; j < 5; j++) {
    for (let l = j + 1; l < 5; l++) {
      const [ajx, ajy] = G[j]!;
      const [alx, aly] = G[l]!;
      const det = ajx * aly - ajy * alx;
      const [j0, j1] = range(j);
      const [l0, l1] = range(l);
      for (let kj = j0; kj <= j1; kj++) {
        for (let kl = l0; kl <= l1; kl++) {
          const bj = kj - g[j]!;
          const bl = kl - g[l]!;
          const px = (bj * aly - bl * ajy) / det;
          const py = (ajx * bl - alx * bj) / det;
          if (px < 0 || px >= cw || py < 0 || py >= ch) continue;
          const K = G.map(([gx, gy], m) => (m === j ? kj : m === l ? kl : Math.ceil(px * gx + py * gy + g[m]!)));
          let x = 0,
            y = 0;
          K.forEach((k, m) => {
            x += k * E[m]![0];
            y += k * E[m]![1];
          });
          const [ex, ey] = E[j]!;
          const [fx, fy] = E[l]!;
          // Reduce by the centre into the rectangle.
          const dx = mod(x + (ex + fx) / 2, width) - (x + (ex + fx) / 2);
          const dy = mod(y + (ey + fy) / 2, height) - (y + (ey + fy) / 2);
          x += dx;
          y += dy;
          const index = K.reduce((s, k) => s + k, 0);
          out.push({
            points: [
              [x, y],
              [x + ex, y + ey],
              [x + ex + fx, y + ey + fy],
              [x + fx, y + fy],
            ],
            fat: l - j === 1 || l - j === 4,
            index,
          });
        }
      }
    }
  }
  return { rhombs: out, width, height };
}

// Edge identity on the torus W x H: midpoint modulo the period plus the unsigned direction.
export function torusEdgeKey(p: Pt, q: Pt, W: number, H: number): string {
  const r = (v: number, m: number) => Math.round(mod(v, m) * 1e5) % Math.round(m * 1e5);
  let dx = q[0] - p[0];
  let dy = q[1] - p[1];
  if (dx < -1e-9 || (Math.abs(dx) <= 1e-9 && dy < 0)) [dx, dy] = [-dx, -dy];
  return `${r((p[0] + q[0]) / 2, W)},${r((p[1] + q[1]) / 2, H)},${Math.round(dx * 1e4)},${Math.round(dy * 1e4)}`;
}

// ponytail: an odd shift keeps tile edges off the tile border (a border segment breaks the seam).
const OFF: Pt = [Math.SQRT2 / 10, Math.sqrt(3) / 10];

export const PENROSE_MAX_DEPTH = 4;
const MAX_RHOMBS = 2500;

// For a depth: the level and the m1 x m2 copies whose aspect is closest to 1, within MAX_RHOMBS.
export function tilePlan(depth: number): { level: number; m1: number; m2: number; distortion: number } {
  const level = Math.min(Math.max(depth, 1), PENROSE_MAX_DEPTH) + 1;
  const a = approximant(1, level);
  let best = { level, m1: 1, m2: 1, distortion: Infinity };
  for (let m1 = 1; m1 <= 6; m1++)
    for (let m2 = 1; m2 <= 6; m2++) {
      if (a.rhombs.length * m1 * m2 > MAX_RHOMBS) continue;
      const distortion = Math.abs((m1 * a.width) / (m2 * a.height) - 1);
      if (distortion < best.distortion - 1e-9) best = { level, m1, m2, distortion };
    }
  return best;
}

// Square repeating tile: the approximant rectangle (times m1 x m2) scaled to size x size, with
// separate x and y scales (the distortion per depth is reported by tilePlan).
export function penroseTile(rnd: Rng, depth: number, size: number, decorate: 'edges' | 'arcs' | 'both'): Poly[] {
  const seed = Math.floor(rnd() * 2 ** 32);
  const { level, m1, m2 } = tilePlan(depth);
  const a = approximant(seed, level);
  const W = a.width * m1;
  const H = a.height * m2;
  const rhombs: Rhomb[] = [];
  for (let i = 0; i < m1; i++)
    for (let k = 0; k < m2; k++)
      for (const r of a.rhombs)
        rhombs.push({ ...r, points: r.points.map(([x, y]): Pt => [x + i * a.width, y + k * a.height]) as unknown as Rhomb['points'] });
  const polys: Poly[] = [];
  if (decorate !== 'arcs') {
    // Each torus edge once: reduce by its midpoint before deduplication.
    const seen = new Map<string, Poly>();
    for (const [p, q] of patchEdges(rhombs)) {
      const dx = mod((p![0] + q![0]) / 2, W) - (p![0] + q![0]) / 2;
      const dy = mod((p![1] + q![1]) / 2, H) - (p![1] + q![1]) / 2;
      seen.set(torusEdgeKey(p!, q!, W, H), [
        [p![0] + dx + OFF[0], p![1] + dy + OFF[1]],
        [q![0] + dx + OFF[0], q![1] + dy + OFF[1]],
      ]);
    }
    polys.push(...seen.values());
  }
  if (decorate !== 'edges')
    polys.push(...rhombs.flatMap((r) => rhombArcs(r)).map((poly) => poly.map(([x, y]): Pt => [x + OFF[0], y + OFF[1]])));
  const sx = size / W;
  const sy = size / H;
  return wrap(
    polys.map((poly) => poly.map(([x, y]): Pt => [x * sx, y * sy])),
    size,
  );
}

const gen =
  (decorate: 'edges' | 'arcs' | 'both'): Generator =>
  (rnd, depth, size) =>
    penroseTile(rnd, depth, size, decorate);
export const penroseEdges = gen('edges');
export const penroseArcs = gen('arcs');
export const penroseBoth = gen('both');
