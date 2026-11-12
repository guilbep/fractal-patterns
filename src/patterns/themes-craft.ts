// Craft theme kinds: Celtic knotwork and a roof of overlapping tiles. Both live on a torus.
import { wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const THEME_CRAFT_MAX_DEPTH = { knot: 5, roof: 5 } as const;

const pick = <T>(rnd: Rng, xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T;
const clampDepth = (depth: number, max: number) => Math.max(1, Math.min(max, Math.round(depth)));

// Knot lattice: L x L points (a, b), L = 2 * (depth + 1), a crossing where a + b is odd, so neighbours
// along a diagonal differ by one in a and the over strand alternates. Pixel position (a + 0.3) * g.
export type KnotCrossing = { a: number; b: number; x: number; y: number; wall: 'h' | 'v' | null; over: '/' | '\\' | null; r: number };

const GAP = 0.3; // gap radius around an over strand, in lattice steps

export function knotCrossings(rnd: Rng, depth: number, size: number, breaks = true): KnotCrossing[] {
  const L = 2 * (1 + clampDepth(depth, THEME_CRAFT_MAX_DEPTH.knot));
  const g = size / L;
  const p = breaks ? 0.12 + 0.25 * rnd() : 0;
  const out: KnotCrossing[] = [];
  for (let a = 0; a < L; a++) {
    for (let b = 0; b < L; b++) {
      if ((a + b) % 2 === 0) continue;
      const wall = rnd() < p ? (rnd() < 0.5 ? 'h' : 'v') : null;
      // Even a: '/' (up-right on screen) on top, odd a: '\' on top.
      out.push({ a, b, x: (a + 0.3) * g, y: (b + 0.3) * g, wall, over: wall ? null : a % 2 === 0 ? '/' : '\\', r: GAP * g });
    }
  }
  return out;
}

const bezier = (p0: Pt, c: Pt, p2: Pt, n = 4): Poly =>
  Array.from({ length: n + 1 }, (_, i): Pt => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]];
  });

// Chains pieces that share an exact end point into longer polylines (a closed loop repeats its first point).
function join(pieces: Poly[]): Poly[] {
  const key = (p: Pt) => `${p[0]},${p[1]}`;
  const ends = new Map<string, number[]>();
  pieces.forEach((piece, i) => {
    for (const e of [piece[0]!, piece[piece.length - 1]!]) ends.set(key(e), [...(ends.get(key(e)) ?? []), i]);
  });
  const used = new Set<number>();
  const next = (pt: Pt) => (ends.get(key(pt)) ?? []).find((i) => !used.has(i));
  const out: Poly[] = [];
  pieces.forEach((piece, i) => {
    if (used.has(i)) return;
    used.add(i);
    let line = [...piece];
    for (let pass = 0; pass < 2; pass++) {
      for (let j = next(line[line.length - 1]!); j !== undefined; j = next(line[line.length - 1]!)) {
        used.add(j);
        const q = pieces[j]!;
        line.push(...(key(q[0]!) === key(line[line.length - 1]!) ? q : [...q].reverse()).slice(1));
      }
      line = line.reverse();
    }
    // Drop points in the middle of a straight run.
    out.push(
      line.filter((p, k) => {
        const s = line[k - 1];
        const t = line[k + 1];
        if (!s || !t) return true;
        const cross = (p[0] - s[0]) * (t[1] - p[1]) - (p[1] - s[1]) * (t[0] - p[0]);
        return Math.abs(cross) > 1e-9 || (p[0] - s[0]) * (t[0] - p[0]) + (p[1] - s[1]) * (t[1] - p[1]) <= 0;
      }),
    );
  });
  return out;
}

// Celtic knotwork: diagonal strands cross at every lattice crossing; a seeded wall turns a crossing
// into two rounded turns. The under strand stops GAP short of the over strand on both sides.
export const knot: Generator = (rnd, depth, size) => {
  const crossings = knotCrossings(rnd, depth, size);
  const g = size / (2 * (1 + clampDepth(depth, THEME_CRAFT_MAX_DEPTH.knot)));
  const k = GAP / Math.SQRT2;
  const pieces: Poly[] = [];
  for (const { a, b, wall, over } of crossings) {
    // Link midpoints in lattice units (exact halves, so neighbouring crossings meet on the same key).
    const q: Pt = [a, b];
    const ne: Pt = [a + 0.5, b - 0.5];
    const nw: Pt = [a - 0.5, b - 0.5];
    const se: Pt = [a + 0.5, b + 0.5];
    const sw: Pt = [a - 0.5, b + 0.5];
    if (wall === 'h') pieces.push(bezier(nw, q, ne), bezier(sw, q, se));
    else if (wall === 'v') pieces.push(bezier(nw, q, sw), bezier(ne, q, se));
    else if (over === '/') pieces.push([sw, ne], [nw, [a - k, b - k]], [[a + k, b + k], se]);
    else pieces.push([nw, se], [sw, [a - k, b + k]], [[a + k, b - k], ne]);
  }
  const px = join(pieces).map((poly) => poly.map(([x, y]): Pt => [(x + 0.3) * g, (y + 0.3) * g]));
  return wrap(px, size);
};

const ROOF_SHAPES = ['round', 'pointed', 'clipped'] as const;
export type RoofShape = (typeof ROOF_SHAPES)[number];
// The first draw of the roof generator: the tile shape for the whole roof.
export const roofShape = (rnd: Rng): RoofShape => pick(rnd, ROOF_SHAPES);

// Lower edge of one tile, left to right, from the bottom of the left side to the bottom of the right side.
function profile(shape: RoofShape, x0: number, w: number, yB: number, h: number): Poly {
  const x1 = x0 + w;
  if (shape === 'round') {
    const ry = 0.45 * h;
    return Array.from({ length: 7 }, (_, i): Pt => {
      const th = (Math.PI * i) / 6;
      return [x0 + (w / 2) * (1 - Math.cos(th)), yB - ry + ry * Math.sin(th)];
    });
  }
  if (shape === 'pointed') {
    const ys = yB - 0.4 * h;
    const yq = ys + 0.62 * (yB - ys);
    return [
      [x0, ys],
      [x0 + w / 4, yq],
      [x0 + w / 2, yB],
      [x1 - w / 4, yq],
      [x1, ys],
    ];
  }
  const c = 0.2 * w;
  return [
    [x0, yB - 0.6 * c],
    [x0 + c, yB],
    [x1 - c, yB],
    [x1, yB - 0.6 * c],
  ];
}

// Roof tiles seen from the front: rows offset by half a tile, each tile closed below the lap line,
// with a few slipped, cracked or chipped tiles and, from depth 3, one or two missing (a batten shows).
export const roof: Generator = (rnd, depth, size) => {
  const shape = roofShape(rnd);
  const d = clampDepth(depth, THEME_CRAFT_MAX_DEPTH.roof);
  const k = 2 + d;
  const R = 2 * Math.max(1, Math.round(k * (0.55 + 0.3 * rnd())));
  const w = size / k;
  const h = size / R;
  const gone = new Set(Array.from({ length: d >= 3 ? 1 + Math.floor(rnd() * 2) : 0 }, () => Math.floor(rnd() * k * R)));
  const out: Poly[] = [];
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < k; i++) {
      // Offsets keep every side and lap line off the tile edges.
      const x0 = (i + 0.15 + (j % 2) * 0.5) * w;
      const x1 = x0 + w;
      const yT = (j + 0.3) * h;
      const life = rnd();
      const where = rnd();
      if (gone.has(j * k + i)) {
        out.push([
          [x0, yT + 0.45 * h],
          [x1, yT + 0.45 * h],
        ]);
        continue;
      }
      let pts = profile(shape, x0, w, yT + h + (life < 0.08 ? 0.25 * h : 0), h);
      if (life > 0.92) {
        const left = where < 0.5;
        // Missing corner: a straight cut from the side to the lower edge 0.25 w in.
        const xq = left ? x0 + 0.25 * w : x1 - 0.25 * w;
        const i = pts.findIndex(([x]) => x > xq);
        const [ax, ay] = pts[i - 1]!;
        const [bx, by] = pts[i]!;
        const q: Pt = [xq, ay + ((by - ay) * (xq - ax)) / (bx - ax)];
        const end = left ? pts[0]! : pts[pts.length - 1]!;
        const corner: Pt = [end[0], end[1] - 0.25 * h];
        pts = left ? [corner, q, ...pts.slice(i)] : [...pts.slice(0, i), q, corner];
      } else if (life > 0.84) {
        const [px, py] = pts[1 + Math.floor(where * (pts.length - 2))]!;
        const s = where < 0.5 ? 1 : -1;
        out.push([
          [px, py],
          [px + s * 0.08 * w, py - 0.22 * h],
          [px - s * 0.04 * w, py - 0.42 * h],
        ]);
      }
      out.push([[x0, yT], ...pts, [x1, yT], [x0, yT]]);
    }
  }
  return wrap(out, size);
};
