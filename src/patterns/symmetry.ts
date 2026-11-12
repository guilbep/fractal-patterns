// Family 'symmetry': wallpaper groups on a square unit cell. A seeded asymmetric motif is drawn
// in the fundamental region, copied by every operation of the group to fill the cell [0,1]^2,
// and the cell repeats n by n times in the tile. A new group is one GROUP_OPS entry, one
// GROUP_REGION entry, a generator line (wallpaper('id')) and its row in the PATTERNS table.
import { thin, wrap, TAU, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export type Op = (p: Pt) => Pt;

const mod1 = (v: number): number => v - Math.floor(v);

// Operations mapping the fundamental region onto all its copies inside one unit cell; identity first.
export const GROUP_OPS: Readonly<Record<string, readonly Op[]>> = {
  p1: [(p) => p],
  p2: [(p) => p, ([x, y]) => [1 - x, 1 - y]],
  pm: [(p) => p, ([x, y]) => [1 - x, y]],
  pg: [(p) => p, ([x, y]) => [mod1(x + 0.5), 1 - y]],
  cm: [(p) => p, ([x, y]) => [1 - x, y], ([x, y]) => [mod1(x + 0.5), mod1(y + 0.5)], ([x, y]) => [mod1(0.5 - x), mod1(y + 0.5)]],
  pmm: [(p) => p, ([x, y]) => [1 - x, y], ([x, y]) => [x, 1 - y], ([x, y]) => [1 - x, 1 - y]],
  pmg: [(p) => p, ([x, y]) => [1 - x, 1 - y], ([x, y]) => [mod1(x + 0.5), 1 - y], ([x, y]) => [mod1(0.5 - x), y]],
  pgg: [(p) => p, ([x, y]) => [1 - x, 1 - y], ([x, y]) => [mod1(x + 0.5), mod1(0.5 - y)], ([x, y]) => [mod1(0.5 - x), mod1(y + 0.5)]],
};

// Fundamental region of each group as a box [x0, y0, x1, y1] in the unit cell; the motif fills it.
export const GROUP_REGION: Readonly<Record<string, readonly [number, number, number, number]>> = {
  p1: [0, 0, 1, 1],
  p2: [0, 0, 0.5, 1],
  pm: [0, 0, 0.5, 1],
  pg: [0, 0, 0.5, 1],
  cm: [0, 0, 0.5, 0.5],
  pmm: [0, 0, 0.5, 0.5],
  // pmg: [0, 0, 0.5, 0.5] would collide (half turn and glide both land on the top right quarter).
  pmg: [0.25, 0, 0.75, 0.5],
  pgg: [0, 0, 0.5, 0.5],
};

const N = 90; // samples per shape before thinning
const range = (f: (t: number) => Pt, closed = false): Pt[] => Array.from({ length: N + 1 }, (_, j) => f((j / N) * (closed ? TAU : 1)));
const rot = ([x, y]: Pt, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

// Leaf: a closed loop of two arcs from base to tip, width ratio w.
function leaf(base: Pt, angle: number, len: number, w: number): Pt[] {
  return range((t) => {
    const s = t < Math.PI ? t / Math.PI : 2 - t / Math.PI; // base -> tip -> base
    const side = t < Math.PI ? 1 : -1;
    return add(base, rot([s * len, side * w * len * Math.sin(Math.PI * s)], angle));
  }, true);
}

// Teardrop: round end at the centre side, point at angle.
function drop(c: Pt, angle: number, r: number): Pt[] {
  return range((t) => add(c, rot([r * Math.cos(t), r * Math.sin(t) * Math.sin(t / 2)], angle)), true);
}

// Fan: k concentric arcs of growing radius over a seeded spread.
function fan(c: Pt, angle: number, r: number, k: number): Pt[][] {
  return Array.from({ length: k }, (_, i) => {
    const ri = r * (0.45 + (0.55 * i) / Math.max(1, k - 1));
    return range((t) => add(c, [ri * Math.cos(angle + 1.9 * t), ri * Math.sin(angle + 1.9 * t)]));
  });
}

// Ring with a smaller off-centre ring inside (an eye), so it has no symmetry of its own.
function eye(c: Pt, angle: number, r: number): Pt[][] {
  const inner = add(c, rot([0.35 * r, 0], angle));
  return [range((t) => add(c, [r * Math.cos(t), r * Math.sin(t)]), true), range((t) => add(inner, [0.4 * r * Math.cos(t), 0.4 * r * Math.sin(t)]), true)];
}

// Motif in region coordinates: an S-stem from bottom to top of the region with 2 or 3 leaves
// (it alone covers most of the box), then depth more shapes: leaves, drops, fans, eyes.
function motif(rnd: Rng, depth: number, [x0, y0, x1, y1]: readonly [number, number, number, number]): Pt[][] {
  const w = x1 - x0;
  const h = y1 - y0;
  const s = Math.min(w, h);
  const at = (u: number, v: number): Pt => [x0 + u * w, y0 + v * h];
  const flip = rnd() < 0.5;
  const u = (a: number): number => (flip ? 1 - a : a);
  const p0 = at(u(0.1 + 0.1 * rnd()), 0.05 + 0.08 * rnd());
  const p1 = at(u(0.95), 0.3 + 0.1 * rnd());
  const p2 = at(u(0.05), 0.6 + 0.1 * rnd());
  const p3 = at(u(0.8 + 0.1 * rnd()), 0.9 + 0.06 * rnd());
  const bez = (t: number): Pt => {
    const v = 1 - t;
    const k = [v * v * v, 3 * v * v * t, 3 * v * t * t, t * t * t] as const;
    return [k[0] * p0[0] + k[1] * p1[0] + k[2] * p2[0] + k[3] * p3[0], k[0] * p0[1] + k[1] * p1[1] + k[2] * p2[1] + k[3] * p3[1]];
  };
  const out: Pt[][] = [range(bez)];
  const leaves = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < leaves; i++) {
    const t = 0.25 + (0.6 * i) / leaves + 0.1 * rnd();
    const a = bez(t);
    const b = bez(t + 0.01);
    const side = i % 2 ? 1 : -1;
    out.push(leaf(a, Math.atan2(b[1] - a[1], b[0] - a[0]) + side * (0.7 + 0.4 * rnd()), s * (0.35 + 0.2 * rnd()), 0.3 + 0.1 * rnd()));
  }
  for (let i = 0; i < depth; i++) {
    const c = at(0.2 + 0.6 * rnd(), 0.15 + 0.7 * rnd());
    const angle = rnd() * TAU;
    const kind = Math.floor(rnd() * 4);
    if (kind === 0) out.push(leaf(c, angle, s * (0.4 + 0.3 * rnd()), 0.35));
    else if (kind === 1) out.push(drop(c, angle, s * (0.2 + 0.15 * rnd())));
    else if (kind === 2) out.push(...fan(c, angle, s * (0.3 + 0.2 * rnd()), 3 + Math.floor(rnd() * 2)));
    else out.push(...eye(c, angle, s * (0.18 + 0.12 * rnd())));
  }
  return out;
}

// depth 1..3: the stem plus depth shapes in the motif; 1 cell per tile edge at depth 1, then 2
// (3 cells crowd a 120 px tile and break the size cap). Groups of 4 ops keep 1 cell: 2 by 2 cells
// of them pass 20k chars at depth 3, and the quarter region would shrink to 30 px.
export function wallpaper(group: string): Generator {
  const ops = GROUP_OPS[group] ?? [];
  const region = GROUP_REGION[group] ?? [0, 0, 1, 1];
  return (rnd, depth, size) => {
    const n = ops.length >= 4 ? 1 : Math.min(depth, 2);
    const cell = size / n;
    const shapes = motif(rnd, depth, region);
    const out: Poly[] = [];
    for (const op of ops) {
      for (const shape of shapes) {
        // Ops taken modulo 1 (the glide) can split a shape that leaves its region; undo the jumps
        // so the polyline stays continuous and wrap() carries it across the border instead.
        const moved: Pt[] = [];
        for (const p of shape.map(op)) {
          const q = moved[moved.length - 1];
          moved.push(q ? [p[0] - Math.round(p[0] - q[0]), p[1] - Math.round(p[1] - q[1])] : p);
        }
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            out.push(thin(moved.map(([x, y]): Pt => [(x + i) * cell, (y + j) * cell]), 2));
          }
        }
      }
    }
    return wrap(out, size);
  };
}

export const p1 = wallpaper('p1');
export const p2 = wallpaper('p2');
export const pm = wallpaper('pm');
export const pg = wallpaper('pg');
export const cm = wallpaper('cm');
export const pmm = wallpaper('pmm');
export const pmg = wallpaper('pmg');
export const pgg = wallpaper('pgg');
