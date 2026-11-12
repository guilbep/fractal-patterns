// Family 'symmetry': wallpaper groups on a square unit cell. A seeded asymmetric motif is drawn
// in the fundamental region, copied by every operation of the group to fill the cell [0,1]^2,
// and the cell repeats n by n times in the tile. A new group is one GROUP_OPS entry plus a
// generator line (wallpaper('id')) and its row in the PATTERNS table.
import { thin, wrap, TAU, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export type Op = (p: Pt) => Pt;

const mod1 = (v: number): number => v - Math.floor(v);

// Operations mapping the fundamental region onto all its copies inside one unit cell; identity first.
export const GROUP_OPS: Readonly<Record<string, readonly Op[]>> = {
  p1: [(p) => p],
  p2: [(p) => p, ([x, y]) => [1 - x, 1 - y]],
  pm: [(p) => p, ([x, y]) => [1 - x, y]],
  pg: [(p) => p, ([x, y]) => [mod1(x + 0.5), 1 - y]],
};

// Motif box: the left half of the cell, which is a fundamental region of p2, pm and pg (and the
// half of one for p1). Curves stay inside it in x; in y they may cross the cell border.
// ponytail: one shared box; groups whose fundamental region is a quarter or a triangle (p4, cm...)
// will need a per-group region next to their ops.
const X0 = 0.06;
const X1 = 0.44;

function motif(rnd: Rng, curves: number): Pt[][] {
  const y0 = rnd();
  const pick = (): Pt => [X0 + (X1 - X0) * rnd(), y0 + 0.8 * rnd()];
  const out: Pt[][] = [];
  for (let c = 0; c < curves; c++) {
    const poly: Pt[] = [];
    if (rnd() < 0.35) {
      // Spiral hook: a shrinking turn and a half, then a tail.
      const r0 = 0.06 + 0.08 * rnd();
      const cx = X0 + r0 + (X1 - X0 - 2 * r0) * rnd();
      const cy = y0 + 0.8 * rnd();
      const a0 = rnd() * TAU;
      const hand = rnd() < 0.5 ? 1 : -1;
      for (let j = 0; j <= 60; j++) {
        const t = j / 60;
        const r = r0 * (1 - 0.75 * t);
        poly.push([cx + r * Math.cos(a0 + hand * t * 1.5 * TAU), cy + r * Math.sin(a0 + hand * t * 1.5 * TAU)]);
      }
    } else {
      // Smooth arc: a cubic Bezier, inside the box in x because its control points are.
      const [a, b, d, e] = [pick(), pick(), pick(), pick()];
      for (let j = 0; j <= 60; j++) {
        const t = j / 60;
        const u = 1 - t;
        const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
        poly.push([w[0] * a[0] + w[1] * b[0] + w[2] * d[0] + w[3] * e[0], w[0] * a[1] + w[1] * b[1] + w[2] * d[1] + w[3] * e[1]]);
      }
    }
    out.push(poly);
  }
  return out;
}

// depth 1..3: 1 + depth curves in the motif, depth cells per tile edge.
export function wallpaper(group: string): Generator {
  const ops = GROUP_OPS[group] ?? [];
  return (rnd, depth, size) => {
    const n = depth;
    const cell = size / n;
    const shapes = motif(rnd, 1 + depth);
    const out: Poly[] = [];
    for (const op of ops) {
      for (const shape of shapes) {
        const moved = shape.map(op);
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
