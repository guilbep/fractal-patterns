// Turing stripes and spots: Gray-Scott reaction-diffusion on an n x n torus, contoured into a seamless tile.

import { isolines } from '../isolines.ts';
import { simplify } from '../simplify.ts';
import { wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export type ReactionKind = 'stripes' | 'spots';

const REGIME: Record<ReactionKind, { F: number; k: number }> = {
  stripes: { F: 0.035, k: 0.06 },
  // Measured at n = 64, 2000 steps: F 0.0545 gave 4 to 5 worm-like components, F 0.03 gives about 24 spots.
  spots: { F: 0.03, k: 0.062 },
};
const GRID = [32, 48, 64];
const STEPS = 2000;
// Share of the tile inside the contour.
const INSIDE = 0.45;

/** V field after `steps` on an n x n torus, seeded with 6 x 6 blobs (single pixels die out). */
export function grayScott(n: number, steps: number, F: number, k: number, rnd: Rng): Float32Array {
  let U = new Float32Array(n * n).fill(1);
  let V = new Float32Array(n * n);
  let U2 = new Float32Array(n * n);
  let V2 = new Float32Array(n * n);
  const blobs = Math.max(1, Math.round((n * n) / 600));
  for (let b = 0; b < blobs; b++) {
    const cx = Math.floor(rnd() * n);
    const cy = Math.floor(rnd() * n);
    for (let dy = -3; dy < 3; dy++) {
      for (let dx = -3; dx < 3; dx++) {
        const i = ((cy + dy + n) % n) * n + ((cx + dx + n) % n);
        U[i] = 0.5;
        V[i] = 0.25;
      }
    }
  }
  const Du = 0.16;
  const Dv = 0.08;
  for (let t = 0; t < steps; t++) {
    for (let y = 0; y < n; y++) {
      const ym = ((y + n - 1) % n) * n;
      const yp = ((y + 1) % n) * n;
      const yc = y * n;
      for (let x = 0; x < n; x++) {
        const xm = (x + n - 1) % n;
        const xp = (x + 1) % n;
        const i = yc + x;
        const u = U[i]!;
        const v = V[i]!;
        const uvv = u * v * v;
        U2[i] = u + Du * (U[ym + x]! + U[yp + x]! + U[yc + xm]! + U[yc + xp]! - 4 * u) - uvv + F * (1 - u);
        V2[i] = v + Dv * (V[ym + x]! + V[yp + x]! + V[yc + xm]! + V[yc + xp]! - 4 * v) + uvv - (F + k) * v;
      }
    }
    [U, U2] = [U2, U];
    [V, V2] = [V2, V];
  }
  return V;
}

/** Level with `INSIDE` of the cells above it. */
export function insideLevel(V: Float32Array): number {
  const sorted = Float32Array.from(V).sort();
  return sorted[Math.floor((1 - INSIDE) * (sorted.length - 1))]!;
}

export function reactionField(kind: ReactionKind, rnd: Rng, depth: number): { n: number; V: Float32Array; level: number } {
  const n = GRID[Math.min(3, Math.max(1, Math.floor(depth))) - 1]!;
  const { F, k } = REGIME[kind];
  const V = grayScott(n, STEPS, F, k, rnd);
  return { n, V, level: insideLevel(V) };
}

export function reactionShapes(kind: ReactionKind, rnd: Rng, depth: number, size: number): Poly[] {
  const { n, V, level } = reactionField(kind, rnd, depth);
  // Pad one wrapped row and column on the far side: cell centers then span exactly [0, size], and the
  // contour on the right edge is computed from the same values as on the left, so the ends match exactly.
  const m = n + 1;
  const data = new Float32Array(m * m);
  for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) data[y * m + x] = V[(y % n) * n + (x % n)]!;
  const s = size / n;
  const lines = isolines({ data, width: m, height: m }, level).map((l) => l.map(([x, y]): Pt => [(x - 0.5) * s, (y - 0.5) * s]));
  // ponytail: wrap() only clips here, the padded grid already lands on [0, size].
  return wrap(lines, size)
    .filter((l) => l.length > 1)
    .map((l) => simplify(l, 0.6));
}

export const reactionGenerator =
  (kind: ReactionKind): Generator =>
  (rnd, depth, size) =>
    reactionShapes(kind, rnd, depth, size);
