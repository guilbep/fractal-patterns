// Chladni figures: the nodal lines (where the plate does not move) of a square plate,
// f = a (cos(n u) cos(m v) + s cos(m u) cos(n v)) + b (cos(k u) cos(l v) + s2 cos(l u) cos(k v)),
// with u, v full periods over the tile so the figure repeats with no seam.
import { simplify } from '../simplify.ts';
import { TAU, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const CHLADNI_MAX_DEPTH = 5;

export type ChladniParams = {
  n: number;
  m: number;
  k: number;
  l: number;
  s: 1 | -1;
  s2: 1 | -1;
  a: number;
  b: number;
  // Half-tile shifts (0 or 1): u -> u + pi pu, v -> v + pi pv.
  pu: 0 | 1;
  pv: 0 | 1;
  // Level offset in units of a: lines that cross at a saddle where f = 0 exactly would make
  // every saddle cell a coin toss, so the level sits +-1e-4 a off zero (seeded sign).
  eps: number;
};

// f at unit coords (x, y) in [0, 1], minus the level offset: its zero set is what is drawn.
export const fieldOf =
  (p: ChladniParams) =>
  (x: number, y: number): number => {
    const u = TAU * x + Math.PI * p.pu;
    const v = TAU * y + Math.PI * p.pv;
    const c = Math.cos;
    return (
      p.a * (c(p.n * u) * c(p.m * v) + p.s * c(p.m * u) * c(p.n * v)) +
      p.b * (c(p.k * u) * c(p.l * v) + p.s2 * c(p.l * u) * c(p.k * v)) -
      p.eps
    );
  };

const modes = (rnd: Rng, depth: number): [number, number] => {
  const top = depth + 1;
  const n = 1 + Math.floor(rnd() * top);
  let m = n;
  while (m === n) m = 1 + Math.floor(rnd() * top);
  return [n, m];
};

const draw = (rnd: Rng, depth: number): ChladniParams => {
  const [n, m] = modes(rnd, depth);
  const [k, l] = modes(rnd, depth);
  const s = rnd() < 0.5 ? 1 : -1;
  const s2 = rnd() < 0.5 ? 1 : -1;
  const b = rnd() < 0.3 ? 0 : 0.6 * rnd();
  const pu = rnd() < 0.3 ? 1 : 0;
  const pv = rnd() < 0.3 ? 1 : 0;
  const eps = (rnd() < 0.5 ? 1 : -1) * 1e-4;
  return { n, m, k, l, s, s2, a: 1, b, pu, pv, eps };
};

// Zero set by marching squares on an N x N periodic grid (same scheme as topo): samples are
// taken by index mod N, so the crossings on x = 0 and x = size match exactly.
export function chladniLines(p: ChladniParams, size: number): Poly[] {
  const M = Math.max(p.n, p.m, p.b > 0 ? Math.max(p.k, p.l) : 0);
  // The gap between zeros of cos(M u) is N / (2 M) samples: at least 6 up to M = 8.
  const N = Math.min(96, Math.max(48, 12 * M));
  const field = fieldOf(p);
  const f = Array.from({ length: N }, (_, x) => Array.from({ length: N }, (_, y) => field(x / N, y / N)));
  const val = (x: number, y: number): number => f[x % N]![y % N]!;
  const c = size / N;
  const tol = (0.25 * size) / 120;
  const pts = new Map<string, Pt>();
  const adj = new Map<string, string[]>();
  const point = (key: string): string => {
    if (!pts.has(key)) {
      const [d, xs, ys] = key.split(' ');
      const x = Number(xs);
      const y = Number(ys);
      const a = val(x, y);
      const b = d === 'h' ? val(x + 1, y) : val(x, y + 1);
      const t = a / (a - b);
      pts.set(key, d === 'h' ? [(x + t) * c, y * c] : [x * c, (y + t) * c]);
    }
    return key;
  };
  const link = (a: string, b: string) => {
    point(a);
    point(b);
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  };
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) {
      const [a, b, cc, d] = [val(x, y), val(x + 1, y), val(x + 1, y + 1), val(x, y + 1)];
      const top = `h ${x} ${y}`;
      const right = `v ${x + 1} ${y}`;
      const bottom = `h ${x} ${y + 1}`;
      const left = `v ${x} ${y}`;
      const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (cc > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      switch (code) {
        case 1:
        case 14:
          link(left, top);
          break;
        case 2:
        case 13:
          link(top, right);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 4:
        case 11:
          link(right, bottom);
          break;
        case 6:
        case 9:
          link(top, bottom);
          break;
        case 7:
        case 8:
          link(left, bottom);
          break;
        case 5:
        case 10: {
          // Saddle: the cell average decides which corners join.
          const cutAC = (code === 5) !== (a + b + cc + d) / 4 > 0;
          link(left, cutAC ? top : bottom);
          link(right, cutAC ? bottom : top);
          break;
        }
      }
    }
  }
  const out: Poly[] = [];
  const seen = new Set<string>();
  const walk = (start: string) => {
    const line: Pt[] = [];
    let cur: string | undefined = start;
    let last = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      line.push(pts.get(cur)!);
      last = cur;
      cur = adj.get(cur)!.find((q) => !seen.has(q));
    }
    if (line.length > 2 && adj.get(last)!.includes(start)) line.push(pts.get(start)!);
    // Halves simplified apart keep the middle point, so a border-to-border line never
    // collapses into one segment lying on the border.
    const mid = Math.floor(line.length / 2);
    if (line.length >= 2) out.push([...simplify(line.slice(0, mid + 1), tol), ...simplify(line.slice(mid), tol).slice(1)]);
  };
  for (const [key, ns] of adj) if (ns.length === 1 && !seen.has(key)) walk(key);
  for (const key of adj.keys()) if (!seen.has(key)) walk(key);
  return out;
}

const length = (polys: Poly[]): number => {
  let len = 0;
  for (const poly of polys)
    for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i]![0] - poly[i - 1]![0], poly[i]![1] - poly[i - 1]![1]);
  return len;
};

// The seeded draw, with the re-draw of degenerate modes (fewer than 2 lines, or less than
// 2 tile sides of line): the generator calls this, so a test sees the very field drawn.
export function chladniField(rnd: Rng, depth: number): { params: ChladniParams; f: (x: number, y: number) => number; amp: number } {
  let params = draw(rnd, depth);
  for (let tries = 1; tries < 8; tries++) {
    const lines = chladniLines(params, 120);
    if (lines.length >= 2 && length(lines) >= 240) break;
    params = draw(rnd, depth);
  }
  const f = fieldOf(params);
  let amp = 0;
  for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) amp = Math.max(amp, Math.abs(f(x / 96, y / 96)));
  return { params, f, amp };
}

export const chladni: Generator = (rnd, depth, size) => chladniLines(chladniField(rnd, depth).params, size);
