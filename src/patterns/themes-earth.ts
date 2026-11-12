// Earth and sky theme kinds: a night sky of constellations, root systems, cracked earth.
// All three live on a torus (wrap-around distances, lines through wrap()), so the tile repeats with no seam.
import { simplify } from '../vectorize.ts';
import { TAU, wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const THEME_EARTH_MAX_DEPTH = { stars: 5, roots: 4, cracks: 4 } as const;

const OFFSETS = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [i, j] as const));
// Shortest signed difference on a circle of length size.
const md = (d: number, size: number) => d - size * Math.round(d / size);
const tdist = (a: Pt, b: Pt, size: number) => Math.hypot(md(a[0] - b[0], size), md(a[1] - b[1], size));

// Poisson-like scatter on the torus: rejection with a cap on tries.
function scatter(rnd: Rng, n: number, minD: number, size: number): Pt[] {
  const pts: Pt[] = [];
  for (let tries = 0; tries < n * 30 && pts.length < n; tries++) {
    const p: Pt = [rnd() * size, rnd() * size];
    if (pts.every((q) => tdist(p, q, size) >= minD)) pts.push(p);
  }
  return pts;
}

const circle = ([x, y]: Pt, r: number, sides: number, turn: number): Poly =>
  Array.from({ length: sides + 1 }, (_, k): Pt => {
    const a = turn + (TAU * (k % sides)) / sides;
    return [x + r * Math.cos(a), y + r * Math.sin(a)];
  });

const orient = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
// Proper crossing (touching at a shared star does not count), tested against the 9 wrapped copies of b.
export function crossOnTorus([a, b]: readonly [Pt, Pt], [c, d]: readonly [Pt, Pt], size: number): boolean {
  return OFFSETS.some(([i, j]) => {
    const c2: Pt = [c[0] + i * size, c[1] + j * size];
    const d2: Pt = [d[0] + i * size, d[1] + j * size];
    return orient(a, b, c2) * orient(a, b, d2) < 0 && orient(c2, d2, a) * orient(c2, d2, b) < 0;
  });
}

// Layout of the night sky: star centres (no two closer than minD on the torus) and the
// constellation links between them (each link from a star to an unwrapped copy of its neighbour).
export function starLayout(rnd: Rng, depth: number, size: number) {
  const n = 6 + 10 * depth;
  const minD = (0.7 * size) / Math.sqrt(n);
  const centers = scatter(rnd, n, minD, size);
  const links: [Pt, Pt][] = [];
  const taken = new Set<number>();
  for (let c = 0; c < 1 + depth; c++) {
    let cur = Math.floor(rnd() * centers.length);
    if (taken.has(cur)) continue;
    const want = 3 + Math.floor(rnd() * 4);
    const chain = [cur];
    const mine: [Pt, Pt][] = [];
    while (chain.length < want) {
      const a = centers[cur]!;
      let best = -1;
      let bestD = 2.4 * minD;
      let bestLink: [Pt, Pt] | null = null;
      centers.forEach((q, k) => {
        const d = tdist(a, q, size);
        if (k === cur || d >= bestD || taken.has(k) || chain.includes(k)) return;
        const link: [Pt, Pt] = [a, [a[0] + md(q[0] - a[0], size), a[1] + md(q[1] - a[1], size)]];
        if ([...links, ...mine].some((l) => crossOnTorus(link, l, size))) return;
        best = k;
        bestD = d;
        bestLink = link;
      });
      if (best < 0 || !bestLink) break;
      chain.push(best);
      mine.push(bestLink);
      cur = best;
    }
    if (chain.length < 3) continue;
    for (const k of chain) taken.add(k);
    links.push(...mine);
  }
  return { centers, minD, links };
}

// Night sky: small round stars, a few sparkles, and constellations whose lines stop short of the stars.
export const stars: Generator = (rnd, depth, size) => {
  const { centers, links } = starLayout(rnd, depth, size);
  const r = size / 80;
  const out: Poly[] = [];
  for (const p of centers) {
    if (rnd() < 0.12) {
      const arm = 2.6 * r;
      const t = rnd() * 0.5;
      const u: Pt = [Math.cos(t) * arm, Math.sin(t) * arm];
      out.push([
        [p[0] - u[0], p[1] - u[1]],
        [p[0] + u[0], p[1] + u[1]],
      ]);
      out.push([
        [p[0] + u[1], p[1] - u[0]],
        [p[0] - u[1], p[1] + u[0]],
      ]);
    } else out.push(circle(p, r * (0.9 + 0.4 * rnd()), 6 + Math.floor(rnd() * 3), rnd() * TAU));
  }
  const gap = 3 * r;
  for (const [a, b] of links) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / l;
    const uy = (b[1] - a[1]) / l;
    out.push([
      [a[0] + ux * gap, a[1] + uy * gap],
      [b[0] - ux * gap, b[1] - uy * gap],
    ]);
  }
  return wrap(out, size);
};

// Root systems: main roots wander downward, side roots branch at shallow angles, shorter at
// each level. A torus occupancy grid stops a root that runs into another one; the grid gets finer
// and the main roots more numerous with depth, so the density keeps rising up to the maximum depth.
export const roots: Generator = (rnd, depth, size) => {
  const G = 20 + 10 * depth;
  const cell = size / G;
  const step = size / 30;
  const grid = new Int32Array(G * G).fill(-1);
  const at = (x: number, y: number) => {
    const i = ((Math.floor(x / cell) % G) + G) % G;
    const j = ((Math.floor(y / cell) % G) + G) % G;
    return i * G + j;
  };
  const levels = depth >= 3 ? 3 : 2;
  type Job = { p: Pt; a: number; len: number; level: number; parent: number };
  const jobs: Job[] = Array.from({ length: 2 + depth * depth }, () => ({
    p: [rnd() * size, rnd() * size] as Pt,
    a: Math.PI / 2 + (rnd() - 0.5) * 0.5,
    len: size * (0.55 + 0.35 * rnd()),
    level: 0,
    parent: -1,
  }));
  const out: Poly[] = [];
  for (let id = 0; id < jobs.length; id++) {
    const { p, a, len, level, parent } = jobs[id]!;
    // Starts in the tile, so a root never reaches past the copies wrap() draws.
    let [x, y] = [((p[0] % size) + size) % size, ((p[1] % size) + size) % size];
    const pts: Pt[] = [[x, y]];
    let h = a;
    const steps = Math.round(len / step);
    for (let s = 0; s < steps; s++) {
      // Sway, pulled back toward the start heading (main roots: toward straight down).
      h += (rnd() - 0.5) * 0.5 + ((level === 0 ? Math.PI / 2 : a) - h) * 0.15;
      const nx = x + step * Math.cos(h);
      const ny = y + step * Math.sin(h);
      let hit = false;
      for (const [di, dj] of OFFSETS) {
        const o = grid[at(nx + di * cell, ny + dj * cell)]!;
        if (o >= 0 && o !== id && !(o === parent && s < 4)) hit = true;
      }
      if (hit) break;
      [x, y] = [nx, ny];
      pts.push([x, y]);
      grid[at(x, y)] = id;
      if (level < levels - 1 && s >= 2 && s < steps - 3 && rnd() < 0.22) {
        const side = rnd() < 0.5 ? -1 : 1;
        jobs.push({
          p: [x, y],
          a: h + side * (0.35 + 0.4 * rnd()),
          len: (steps - s) * step * (0.4 + 0.25 * rnd()),
          level: level + 1,
          parent: id,
        });
      }
    }
    if (pts.length >= 3) out.push(simplify(pts, 0.25));
  }
  return wrap(out, size);
};

// Sutherland-Hodgman on a convex polygon whose edges carry labels: the edge from v[k] to v[k+1] has label lab[k].
type Cell = { v: Pt[]; lab: string[] };
function clipCell({ v, lab }: Cell, p: Pt, q: Pt, label: string): Cell {
  // Keep the half-plane closer to p than to q.
  const nx = q[0] - p[0];
  const ny = q[1] - p[1];
  const c = (nx * (p[0] + q[0]) + ny * (p[1] + q[1])) / 2;
  const f = (a: Pt) => c - (nx * a[0] + ny * a[1]);
  const out: Cell = { v: [], lab: [] };
  v.forEach((a, k) => {
    const b = v[(k + 1) % v.length]!;
    const fa = f(a);
    const fb = f(b);
    const cut = (): Pt => {
      const t = fa / (fa - fb);
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    };
    if (fa >= 0) {
      out.v.push(a);
      out.lab.push(lab[k]!);
      if (fb < 0) {
        out.v.push(cut());
        out.lab.push(label);
      }
    } else if (fb >= 0) {
      out.v.push(cut());
      out.lab.push(lab[k]!);
    }
  });
  return out;
}

// Cracked earth: a toroidal Voronoi diagram, each shared edge drawn once with a seeded wobble.
export const cracks: Generator = (rnd, depth, size) => {
  const n = 6 + 7 * depth;
  const minD = (0.75 * size) / Math.sqrt(n);
  const pts = scatter(rnd, n, minD, size);
  const copies = pts.flatMap((q, j) => OFFSETS.map(([i, k]) => ({ j, i, k, q: [q[0] + i * size, q[1] + k * size] as Pt })));
  const done = new Set<string>();
  const stop = (0.2 * (THEME_EARTH_MAX_DEPTH.cracks - depth)) / (THEME_EARTH_MAX_DEPTH.cracks - 1);
  const out: Poly[] = [];
  pts.forEach((p, me) => {
    const near = copies
      .filter((c) => !(c.j === me && c.i === 0 && c.k === 0))
      .map((c) => ({ ...c, d: Math.hypot(c.q[0] - p[0], c.q[1] - p[1]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 24);
    let cell: Cell = {
      v: [
        [p[0] - size, p[1] - size],
        [p[0] + size, p[1] - size],
        [p[0] + size, p[1] + size],
        [p[0] - size, p[1] + size],
      ],
      lab: ['', '', '', ''],
    };
    for (const c of near) {
      // Same key from both sides: the edge between me and j at offset (i, k) is j and me at (-i, -k).
      const flip = c.j < me || (c.j === me && (c.i < 0 || (c.i === 0 && c.k < 0)));
      const key = flip ? `${c.j} ${me} ${-c.i} ${-c.k}` : `${me} ${c.j} ${c.i} ${c.k}`;
      cell = clipCell(cell, p, c.q, key);
    }
    cell.v.forEach((a, k) => {
      const key = cell.lab[k]!;
      if (!key || done.has(key)) return;
      done.add(key);
      const b = cell.v[(k + 1) % cell.v.length]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      const line: Pt[] = [a];
      // Wobble: one or two points pushed off the straight edge, perpendicular to it.
      if (l > 6) {
        const ts = l > 16 ? [0.33 + 0.1 * rnd(), 0.66 + 0.1 * rnd()] : [0.4 + 0.2 * rnd()];
        for (const t of ts) {
          const o = (rnd() - 0.5) * 0.3 * l;
          line.push([a[0] + t * dx - (o * dy) / l, a[1] + t * dy + (o * dx) / l]);
        }
      }
      line.push(b);
      // A few cracks stop short at low depth.
      if (rnd() < stop) {
        const [u, w] = [line[line.length - 2]!, b];
        line[line.length - 1] = [u[0] + 0.3 * (w[0] - u[0]), u[1] + 0.3 * (w[1] - u[1])];
      }
      out.push(line);
    });
  });
  return wrap(out, size);
};
