// Sprigs: short curved stems with a few pointed leaves and a small cluster of round berries.
// Leaves and berries are closed shapes kept whole inside the tile (a closed shape cut by the edge would lose its
// fill); only the open stems cross the edge, through wrap(). The berries are the kind's accent shapes.
import { mulberry32, TAU, wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const SPRIGS_MAX_DEPTH = 3;

// A detail rng per sprig: the layout draws stay the same at every depth.
const fork = (rnd: Rng): Rng => mulberry32(Math.floor(rnd() * 2 ** 32));

// Pointed oval from (0, 0) to (len, 0); closed by pushing the first point again.
function leafShape(len: number, half: number): Poly {
  const K = 6;
  const w = (t: number) => half * Math.pow(Math.sin(Math.PI * t), 0.8);
  const top = Array.from({ length: K + 1 }, (_, i): Pt => [(len * i) / K, -w(i / K)]);
  const bottom = Array.from({ length: K - 1 }, (_, i): Pt => [(len * (K - 1 - i)) / K, w((K - 1 - i) / K)]);
  return [...top, ...bottom, top[0]!];
}

function circle(cx: number, cy: number, r: number): Poly {
  const N = 10;
  const pts = Array.from({ length: N }, (_, i): Pt => [cx + r * Math.cos((TAU * i) / N), cy + r * Math.sin((TAU * i) / N)]);
  return [...pts, pts[0]!];
}

const bbox = (p: Poly) => {
  const xs = p.map((q) => q[0]);
  const ys = p.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
};
const shift = (p: Poly, dx: number, dy: number): Poly => p.map(([x, y]): Pt => [x + dx, y + dy]);

// One sprig with its base at (0, 0), growing along angle a: stem, leaves (each with a midrib), berries on stalks.
function sprig(d: Rng, c: number, a: number) {
  const L = c * (0.62 + d() * 0.12);
  const bend = (d() - 0.5) * 0.5 * L;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const at = (t: number): Pt => {
    const u = t * L;
    const v = bend * Math.sin(Math.PI * 0.8 * t);
    return [u * ca - v * sa, u * sa + v * ca];
  };
  const dir = (t: number) => {
    const [x0, y0] = at(t - 0.01);
    const [x1, y1] = at(t + 0.01);
    return Math.atan2(y1 - y0, x1 - x0);
  };
  const stem: Poly = Array.from({ length: 7 }, (_, i) => at(i / 6));
  const leaves: Poly[] = [];
  const ribs: Poly[] = [];
  const nl = 2 + Math.floor(d() * 2);
  const side0 = d() < 0.5 ? 1 : -1;
  for (let i = 0; i < nl; i++) {
    const t = 0.22 + (0.5 * i) / Math.max(1, nl - 1);
    const len = c * (0.26 + d() * 0.06);
    const half = len * (0.26 + d() * 0.06);
    const s = (i % 2 ? -1 : 1) * side0;
    const ang = dir(t) + s * (0.75 + d() * 0.25);
    const [bx, by] = at(t);
    const k = Math.cos(ang);
    const q = Math.sin(ang);
    const place = ([x, y]: Pt): Pt => [bx + x * k - y * q, by + x * q + y * k];
    leaves.push(leafShape(len, half).map(place));
    ribs.push([place([0, 0]), place([len * 0.75, 0])]);
  }
  // Berries: 2 to 4 around the stem tip, each on a short stalk.
  const nb = 2 + Math.floor(d() * 3);
  const r = c * 0.07;
  const [tx, ty] = at(1);
  const ta = dir(0.99);
  const berries: Poly[] = [];
  const stalks: Poly[] = [];
  for (let i = 0; i < nb; i++) {
    const ba = ta + (i - (nb - 1) / 2) * 0.85 + (d() - 0.5) * 0.2;
    const dist = r * (2.1 + d() * 0.5);
    const cx = tx + dist * Math.cos(ba);
    const cy = ty + dist * Math.sin(ba);
    berries.push(circle(cx, cy, r));
    stalks.push([
      [tx, ty],
      [cx - r * Math.cos(ba), cy - r * Math.sin(ba)],
    ]);
  }
  return { lines: [stem, ...ribs, ...stalks], leaves, berries };
}

// (depth + 1)^2 sprigs on a grid, rows offset by half a cell. Each sprig is moved, as a whole, until none of its
// closed shapes crosses the tile edge (after taking each shape modulo the tile): the shape stays whole and fillable.
export function sprigParts(rnd: Rng, depth: number, size: number) {
  const n = depth + 1;
  const c = size / n;
  const m = size * 0.02; // keeps a stroke of a few px whole at the edge
  const sx = rnd() * c;
  const sy = rnd() * c;
  const lines: Poly[] = [];
  const leaves: Poly[] = [];
  const berries: Poly[] = [];
  const counts: number[] = [];
  const mod = (p: Poly): Poly => {
    const [x0, y0] = bbox(p);
    return shift(p, -Math.floor(x0 / size) * size, -Math.floor(y0 / size) * size);
  };
  // Per axis, the shift nearest to 0 (in 1 px steps, both ways) that keeps every closed shape, taken modulo the
  // tile, inside [m, size - m] on that axis; the two axes are independent. Ends: at most one tile of steps.
  const nearest = (closed: Poly[], axis: 0 | 1, p0: number): number => {
    const ok = (p: number) =>
      closed.every((q) => {
        const lo = Math.min(...q.map((v) => v[axis])) + p;
        const hi = Math.max(...q.map((v) => v[axis])) + p;
        const o = -Math.floor(lo / size) * size;
        return lo + o >= m && hi + o <= size - m;
      });
    for (let k = 0; k < size; k++) for (const p of [p0 + k, p0 - k]) if (ok(p)) return p;
    return p0; // ponytail: unreachable while a sprig's closed shapes span less than the tile minus 2 m
  };
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const d = fork(rnd);
      const s = sprig(d, c, -Math.PI / 2 + (d() - 0.5) * 1.6);
      const closed = [...s.leaves, ...s.berries];
      const px = nearest(closed, 0, (col + 0.3 + (row % 2) * 0.5) * c + sx);
      const py = nearest(closed, 1, (row + 0.85) * c + sy);
      lines.push(...s.lines.map((p) => shift(p, px, py)));
      leaves.push(...s.leaves.map((p) => mod(shift(p, px, py))));
      berries.push(...s.berries.map((p) => mod(shift(p, px, py))));
      counts.push(s.berries.length);
    }
  }
  return { lines: wrap(lines, size), leaves, berries, counts };
}

export const sprigs: Generator = (rnd, depth, size) => {
  const p = sprigParts(rnd, depth, size);
  return [...p.leaves, ...p.lines];
};

export const sprigsAccent: Generator = (rnd, depth, size) => sprigParts(rnd, depth, size).berries;
