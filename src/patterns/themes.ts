// Theme kinds: patterns that depict something (a contour map, a maze, a circuit board).
// All three live on a torus, so the tile repeats with no seam.
import { simplify } from '../simplify.ts';
import { TAU, wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

const pick = <T>(rnd: Rng, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;

// Contour lines of a periodic height field, by marching squares on an N x N sample grid.
// period m: the field has m x m times the terms over an m times larger tile, with frequencies whose
// wavelength stays in the range of m = 1 (i + j >= m), so the contours keep their spacing and the large
// tile holds no repeat. m = 1 draws exactly what it always drew.
export const topo: Generator = (rnd, depth, size, m = 1) => {
  const N = 48 * m;
  const terms = Array.from({ length: (4 + Math.floor(rnd() * 3)) * m * m }, () => {
    let i = 0;
    let j = 0;
    while (i + j < m) {
      i = Math.floor(rnd() * 4 * m);
      j = Math.floor(rnd() * 4 * m);
    }
    return { i, j, a: ((0.4 + rnd() * 0.6) * m) / (i + j), p: rnd() * TAU, q: rnd() * TAU };
  });
  // Sampled by index mod N, so column N equals column 0 exactly and the crossings match.
  // The sines are computed once per term and row (the same values as inline, so the same sums).
  const sx = terms.map((t) => Array.from({ length: N }, (_, x) => Math.sin((TAU * t.i * x) / N + t.p)));
  const sy = terms.map((t) => Array.from({ length: N }, (_, y) => Math.sin((TAU * t.j * y) / N + t.q)));
  const f = Array.from({ length: N }, (_, x) =>
    Array.from({ length: N }, (_, y) => terms.reduce((s, t, k) => s + t.a * sx[k]![x]! * sy[k]![y]!, 0)),
  );
  const v = (x: number, y: number): number => f[x % N]![y % N]!;
  const flat = f.flat();
  const lo = flat.reduce((a, b) => Math.min(a, b));
  const hi = flat.reduce((a, b) => Math.max(a, b));
  const L = 2 + 2 * depth;
  // Level spacing from the mean range over the m x m squares of one tile each (at m = 1, hi - lo):
  // the range of the whole large field grows with its area, which would space the lines wider.
  let R = 0;
  for (let u = 0; u < N; u += 48)
    for (let w = 0; w < N; w += 48) {
      const sub = f.slice(u, u + 48).flatMap((col) => col.slice(w, w + 48));
      R += sub.reduce((a, b) => Math.max(a, b)) - sub.reduce((a, b) => Math.min(a, b));
    }
  R /= m * m;
  const K = Math.round(((hi - lo) / R) * (L + 1)) - 1;
  const c = (size * m) / N;
  const out: Poly[] = [];
  for (let k = 1; k <= K; k++) {
    const level = lo + (R * k) / (L + 1);
    // Points sit on cell edges: 'h x y' is the edge (x,y)-(x+1,y), 'v x y' is (x,y)-(x,y+1).
    const pts = new Map<string, Pt>();
    const adj = new Map<string, string[]>();
    const point = (key: string): string => {
      if (!pts.has(key)) {
        const [d, xs, ys] = key.split(' ');
        const x = Number(xs);
        const y = Number(ys);
        const a = v(x, y);
        const b = d === 'h' ? v(x + 1, y) : v(x, y + 1);
        const t = (level - a) / (b - a);
        pts.set(key, d === 'h' ? [(x + t) * c, y * c] : [x * c, (y + t) * c]);
      }
      return key;
    };
    const link = (a: string, b: string) => {
      for (const [p, q] of [
        [point(a), point(b)],
        [b, a],
      ] as const)
        adj.set(p, [...(adj.get(p) ?? []), q]);
    };
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) {
        const [a, b, cc, d] = [v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)];
        const top = `h ${x} ${y}`;
        const right = `v ${x + 1} ${y}`;
        const bottom = `h ${x} ${y + 1}`;
        const left = `v ${x} ${y}`;
        const code = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (cc > level ? 4 : 0) | (d > level ? 8 : 0);
        const centerUp = (a + b + cc + d) / 4 > level;
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
          case 5: // a and c high: the centre decides whether they join
          case 10: {
            // Cut off the two corners on the other side of the centre.
            const cutAC = (code === 5) !== centerUp;
            link(left, cutAC ? top : bottom);
            link(right, cutAC ? bottom : top);
            break;
          }
        }
      }
    }
    // Walk chains: open ones from their ends first, then the closed loops.
    const seen = new Set<string>();
    const walk = (start: string) => {
      const line: Pt[] = [];
      let cur: string | undefined = start;
      let last = start;
      while (cur !== undefined && !seen.has(cur)) {
        seen.add(cur);
        line.push(pts.get(cur)!);
        last = cur;
        cur = adj.get(cur)!.find((n) => !seen.has(n));
      }
      if (line.length > 2 && adj.get(last)!.includes(start)) line.push(pts.get(start)!);
      // Halves simplified apart keep the middle point, so a line from border to border
      // never collapses into one segment lying on the border.
      const mid = Math.floor(line.length / 2);
      if (line.length >= 2) out.push([...simplify(line.slice(0, mid + 1), 0.4), ...simplify(line.slice(mid), 0.4).slice(1)]);
    };
    for (const [key, ns] of adj) if (ns.length === 1 && !seen.has(key)) walk(key);
    for (const key of adj.keys()) if (!seen.has(key)) walk(key);
  }
  return out;
};

// Toroidal grid, cell (i, j) spans [i c + c/2, (i+1) c + c/2] so no wall lies on the tile border.
// wall[0] = vertical wall left of cell (i, j), wall[1] = horizontal wall above it.
// period m: an m times wider grid of the same cells.
export const maze: Generator = (rnd, depth, cell, m = 1) => {
  const size = cell * m;
  const n = (4 + 2 * depth) * m;
  const c = size / n;
  const id = (i: number, j: number) => (((i % n) + n) % n) * n + (((j % n) + n) % n);
  const walls = [new Uint8Array(n * n).fill(1), new Uint8Array(n * n).fill(1)];
  const seen = new Uint8Array(n * n);
  const stack: [number, number][] = [[Math.floor(rnd() * n), Math.floor(rnd() * n)]];
  seen[id(...stack[0]!)] = 1;
  while (stack.length > 0) {
    const [i, j] = stack[stack.length - 1]!;
    const next = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
    ).filter(([di, dj]) => !seen[id(i + di, j + dj)]);
    if (next.length === 0) {
      stack.pop();
      continue;
    }
    const [di, dj] = pick(rnd, next);
    const [ni, nj] = [i + di, j + dj];
    // The wall between two cells belongs to the right / lower one.
    if (di !== 0) walls[0]![di > 0 ? id(ni, nj) : id(i, j)] = 0;
    else walls[1]![dj > 0 ? id(ni, nj) : id(i, j)] = 0;
    seen[id(ni, nj)] = 1;
    stack.push([ni, nj]);
  }
  const out: Poly[] = [];
  // Merge each grid line's walls into runs, cyclically, starting after a gap.
  for (const axis of [0, 1] as const) {
    for (let line = 0; line < n; line++) {
      const has = (k: number) => walls[axis]![axis === 0 ? id(line, k) : id(k, line)] === 1;
      const gap = Array.from({ length: n }, (_, k) => k).find((k) => !has(k));
      const at = (s: number): Pt => (axis === 0 ? [line * c + c / 2, s] : [s, line * c + c / 2]);
      if (gap === undefined) {
        out.push([at(c / 2), at(c / 2 + size)]);
        continue;
      }
      let start = -1;
      for (let k = gap + 1; k <= gap + n; k++) {
        if (has(k % n) && start < 0) start = k;
        if (!has(k % n) && start >= 0) {
          const s0 = (start % n) * c + c / 2;
          out.push([at(s0), at(s0 + (k - start) * c)]);
          start = -1;
        }
      }
    }
  }
  return wrap(out, size);
};

const circle = ([x, y]: Pt, r: number, sides: number): Poly =>
  Array.from({ length: sides + 1 }, (_, k): Pt => [x + r * Math.cos((TAU * k) / sides), y + r * Math.sin((TAU * k) / sides)]);

const DIRS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const;

// Octilinear traces on a toroidal grid of points (offset half a cell), ending in pads, plus vias.
export const circuit: Generator = (rnd, depth, size) => {
  const n = 6 + 2 * depth;
  const c = size / n;
  const m = (k: number) => ((k % n) + n) % n;
  const used = new Set<string>();
  const diag = new Set<string>(); // cells crossed by a diagonal: a second one would cross it
  const key = (i: number, j: number) => `${m(i)} ${m(j)}`;
  // Offsets c/2 and c/4: no trace lies on the border and no diagonal runs through a tile corner.
  const xy = (i: number, j: number): Pt => [i * c + c / 2, j * c + c / 4];
  const out: Poly[] = [];
  const pad = c * 0.28;
  const free = () => {
    for (let tries = 0; tries < 50; tries++) {
      const i = Math.floor(rnd() * n);
      const j = Math.floor(rnd() * n);
      if (!used.has(key(i, j))) return [i, j] as const;
    }
    return null;
  };
  for (let t = 0; t < n; t++) {
    const s = free();
    if (!s) break;
    let [i, j] = s;
    let d = Math.floor(rnd() * 8);
    used.add(key(i, j));
    const path: [number, number][] = [[i, j]];
    const len = 2 + Math.floor(rnd() * (n - 2));
    while (path.length <= len) {
      if (path.length > 1 && rnd() < 0.3) d = (d + (rnd() < 0.5 ? 1 : 7)) % 8;
      const [di, dj] = DIRS[d]!;
      const cell = key(Math.min(i, i + di), Math.min(j, j + dj));
      if (used.has(key(i + di, j + dj)) || (di !== 0 && dj !== 0 && diag.has(cell))) break;
      if (di !== 0 && dj !== 0) diag.add(cell);
      i += di;
      j += dj;
      used.add(key(i, j));
      path.push([i, j]);
    }
    if (path.length < 2) continue;
    // Keep only the bends, and stop the ends at the pad rims.
    const pts = path.filter((p, k) => {
      const a = path[k - 1];
      const b = path[k + 1];
      return !a || !b || p[0] - a[0] !== b[0] - p[0] || p[1] - a[1] !== b[1] - p[1];
    });
    const trace = pts.map(([a, b]) => xy(a, b));
    const shorten = (p: Pt, q: Pt): Pt => {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      return [p[0] + ((q[0] - p[0]) * pad) / l, p[1] + ((q[1] - p[1]) * pad) / l];
    };
    const first = trace[0]!;
    const last = trace[trace.length - 1]!;
    out.push(circle(first, pad, 8), circle(last, pad, 8));
    trace[0] = shorten(first, trace[1]!);
    trace[trace.length - 1] = shorten(last, trace[trace.length - 2]!);
    out.push(trace);
  }
  for (let k = 0; k < 2 + depth; k++) {
    const s = free();
    if (!s) break;
    used.add(key(...s));
    out.push(circle(xy(...s), c * 0.18, 8));
  }
  return wrap(out, size);
};
