// Experimental Penrose rhomb tiling from de Bruijn's pentagrid (1981).
// A Penrose tiling has no period, so it cannot be a seamless CSS tile: this module draws a
// finite patch of the true tiling. The periodic (Fibonacci) approximant is not built yet.
import { fit, mulberry32, TAU, type Poly, type Pt } from './patterns/util.ts';
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

// ponytail: periodic Fibonacci approximant not built (time box); returns null by contract.
export function approximant(_seed: number, _level: number): { rhombs: Rhomb[]; width: number; height: number } | null {
  return null;
}
