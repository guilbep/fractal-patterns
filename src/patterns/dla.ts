// Coral and frost: diffusion-limited aggregation, off-grid discs on a torus so the tile has no seam.
import { type Generator, type Poly, type Pt, type Rng, wrap } from './util.ts';

export interface DlaOptions {
  particles: number;
  seeds: number;
  radius: number;
  rnd: Rng;
  side?: number;
  // Chance to stick on contact; below 1 walkers slip deeper in and the cluster grows rounder.
  stick?: number;
}

export interface Dla {
  x: Float32Array;
  y: Float32Array;
  parent: Int32Array;
}

export function growDla(o: DlaOptions): Dla {
  const L = o.side ?? 320;
  const r = o.radius;
  const d2r = 2 * r;
  const stick = o.stick ?? 1;
  const rnd = o.rnd;
  const G = Math.max(1, Math.floor(L / d2r));
  const cs = L / G;
  const grid: number[][] = Array.from({ length: G * G }, () => []);
  // Float64 while growing: Float32 rounding would break the exact 2r contact.
  const X = new Float64Array(o.particles);
  const Y = new Float64Array(o.particles);
  const parent = new Int32Array(o.particles).fill(-1);
  let n = 0;
  const md = (v: number) => ((v % L) + L) % L;
  const wd = (a: number) => md(a + L / 2) - L / 2;
  const add = (x: number, y: number, p: number) => {
    x = md(x);
    y = md(y);
    X[n] = x;
    Y[n] = y;
    parent[n] = p;
    grid[(Math.floor(x / cs) % G) * G + (Math.floor(y / cs) % G)]!.push(n++);
  };
  // Nearest particle within rad, or -1.
  let best = -1;
  let bd = 0;
  const near = (x: number, y: number, rad: number) => {
    const kx = Math.floor(x / cs);
    const ky = Math.floor(y / cs);
    const sp = Math.min(Math.ceil(rad / cs), Math.floor((G - 1) / 2));
    best = -1;
    bd = rad;
    for (let i = -sp; i <= sp; i++) {
      for (let j = -sp; j <= sp; j++) {
        for (const q of grid[((((kx + i) % G) + G) % G) * G + ((((ky + j) % G) + G) % G)]!) {
          const d = Math.hypot(wd(X[q]! - x), wd(Y[q]! - y));
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
      }
    }
  };
  for (let i = 0; i < o.seeds && n < o.particles; i++) add(rnd() * L, rnd() * L, -1);
  // Walk on discs: a step of (distance to nearest - 2r) can never enter a disc, so no overlap check per step.
  const R = 12 * r;
  const eps = 0.05 * r;
  while (n < o.particles) {
    let x = rnd() * L;
    let y = rnd() * L;
    near(x, y, d2r);
    if (best >= 0) continue; // born inside the cluster
    for (;;) {
      near(x, y, R);
      const k = best;
      const gap = k >= 0 ? bd - d2r : R - d2r;
      if (k >= 0 && gap < eps) {
        const dx = wd(x - X[k]!);
        const dy = wd(y - Y[k]!);
        const h = Math.hypot(dx, dy) || 1;
        const sx = X[k]! + (dx / h) * d2r;
        const sy = Y[k]! + (dy / h) * d2r;
        near(md(sx), md(sy), d2r - 1e-6);
        if (best < 0 && rnd() < stick) {
          add(sx, sy, k);
          break;
        }
        // Slip: a short hop sideways, kept only if it lands clear.
        const a = rnd() * 2 * Math.PI;
        const nx = md(x + r * Math.cos(a));
        const ny = md(y + r * Math.sin(a));
        near(nx, ny, d2r);
        if (best < 0) {
          x = nx;
          y = ny;
        }
        continue;
      }
      const a = rnd() * 2 * Math.PI;
      const step = Math.max(gap, eps);
      x = md(x + step * Math.cos(a));
      y = md(y + step * Math.sin(a));
    }
  }
  return { x: Float32Array.from(X), y: Float32Array.from(Y), parent };
}

const COUNT = [300, 700, 1400, 2400];
const SIDE = 320;
const KIND = {
  coral: { seeds: [3, 5, 7, 10], radius: 2.4, stick: 0.3 },
  frost: { seeds: [1, 2, 2, 3], radius: 1.8, stick: 1 },
} as const;

export function dlaShapes(kind: 'coral' | 'frost', rnd: Rng, depth: number, size: number): Poly[] {
  const k = KIND[kind];
  const d = Math.min(4, Math.max(1, Math.round(depth))) - 1;
  const n = COUNT[d]!;
  const L = SIDE;
  const { x, y, parent } = growDla({ particles: n, seeds: k.seeds[d]!, radius: k.radius, rnd, side: L, stick: k.stick });
  // Sub-tree sizes: children always come after their parent, so one backward pass sums them.
  const sub = new Int32Array(n).fill(1);
  for (let i = n - 1; i >= 0; i--) if (parent[i]! >= 0) sub[parent[i]!]! += sub[i]!;
  const kids: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) if (parent[i]! >= 0) kids[parent[i]!]!.push(i);
  for (const c of kids) c.sort((a, b) => sub[b]! - sub[a]!);
  const s = size / L;
  const trunk = Math.max(8, n / 25);
  const off = 0.45 * k.radius * s;
  const wd = (v: number) => v - L * Math.round(v / L);
  const out: Poly[] = [];
  // Each chain follows the heaviest child to a tip; the other children start their own chain at the fork.
  const starts: [number, number][] = [];
  for (let i = 0; i < n; i++) if (parent[i]! < 0) starts.push([-1, i]);
  while (starts.length) {
    const [from, first] = starts.pop()!;
    const ids: number[] = from >= 0 ? [from, first] : [first];
    let c = first;
    for (;;) {
      const ch = kids[c]!;
      for (let j = 1; j < ch.length; j++) starts.push([c, ch[j]!]);
      if (!ch.length) break;
      c = ch[0]!;
      ids.push(c);
    }
    if (ids.length < 2) continue;
    // Unwrap: each step is the short way round; wrap() later copies the parts past an edge.
    const pts: Pt[] = [];
    let ux = x[ids[0]!]!;
    let uy = y[ids[0]!]!;
    pts.push([ux, uy]);
    let thick = sub[ids[0]!]! >= trunk ? 1 : 0;
    for (let j = 1; j < ids.length; j++) {
      ux += wd(x[ids[j]!]! - x[ids[j - 1]!]!);
      uy += wd(y[ids[j]!]! - y[ids[j - 1]!]!);
      pts.push([ux, uy]);
      if (sub[ids[j]!]! >= trunk) thick = j + 1;
    }
    out.push(...inTile(pts, s, size, L));
    // Trunks thicker: a second strand beside the heavy part of the chain, so one stroke width reads as two.
    if (thick >= 2) out.push(...inTile(beside(pts.slice(0, thick), off / s), s, size, L));
  }
  return wrap(out, size);
}

// Offset copy of a chain by `off` (torus units), along the vertex normals.
function beside(pts: Pt[], off: number): Pt[] {
  return pts.map(([px, py], i): Pt => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const h = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [px - ((b[1] - a[1]) / h) * off, py + ((b[0] - a[0]) / h) * off];
  });
}

// Unwrapped torus chain -> tile px, cut into pieces that stay within half a tile of it,
// since wrap() only shifts by one tile.
function inTile(pts: Pt[], s: number, size: number, L: number): Poly[] {
  const res: Poly[] = [];
  let piece: Pt[] = [];
  let sx = 0;
  let sy = 0;
  for (const [px, py] of pts) {
    const qx = (px - sx) * s;
    const qy = (py - sy) * s;
    if (qx < -size / 2 || qx > 1.5 * size || qy < -size / 2 || qy > 1.5 * size) {
      const nx = Math.floor(px / L) * L;
      const ny = Math.floor(py / L) * L;
      const last = piece[piece.length - 1]!;
      res.push(piece);
      piece = [[last[0] - (nx - sx) * s, last[1] - (ny - sy) * s]];
      sx = nx;
      sy = ny;
    }
    piece.push([(px - sx) * s, (py - sy) * s]);
  }
  res.push(piece);
  return res;
}

export const dlaGenerator =
  (kind: 'coral' | 'frost'): Generator =>
  (rnd, depth, size) =>
    dlaShapes(kind, rnd, depth, size);
