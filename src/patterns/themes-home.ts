// Theme kinds: railway tracks from above, a patchwork quilt, and hanging paper lanterns.
// All live on a torus, so the tile repeats with no seam.
import { TAU, wrap, type Generator, type Poly, type Pt } from './util.ts';

export const THEME_HOME_MAX_DEPTH = { railway: 3, quilt: 3, lanterns: 3 } as const;

const smooth = (t: number) => t * t * (3 - 2 * t);

// ---------- railway ----------

// Two tracks run across the tile as gentle waves with whole periods, so each rail meets itself
// at the opposite edge. Rails are offset vertically from the centreline, sleepers are cut across it.
// Switches: a branch that leaves one track and joins the other with an S-curve.
export const railway: Generator = (rnd, depth, size) => {
  const g = size * 0.035; // half gauge
  const y0 = (0.1 + rnd() * 0.3) * size;
  const tracks = [0, 1].map((k) => {
    const amp = size * (0.03 + rnd() * 0.05);
    const ph = rnd() * TAU;
    const base = y0 + (k * size) / 2;
    return (x: number) => base + amp * Math.sin((TAU * x) / size + ph);
  });
  const switchAt = [rnd(), rnd()].map((r) => (0.05 + r * 0.4) * size);
  const out: Poly[] = [];
  const N = 32;
  const rails = (f: (x: number) => number, xa: number, xb: number) => {
    for (const s of [-g, g])
      out.push(Array.from({ length: N + 1 }, (_, i): Pt => [xa + ((xb - xa) * i) / N, f(xa + ((xb - xa) * i) / N) + s]));
  };
  const sleepers = (f: (x: number) => number, xa: number, xb: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const x = xa + ((xb - xa) * (i + 0.5)) / n;
      const d = (f(x + 0.5) - f(x - 0.5)) / Math.hypot(1, f(x + 0.5) - f(x - 0.5));
      const c = Math.sqrt(1 - d * d);
      const h = g * 1.7;
      out.push([
        [x + d * h, f(x) - c * h],
        [x - d * h, f(x) + c * h],
      ]);
    }
  };
  const nSleep = 8 + 4 * (depth - 1);
  for (const f of tracks) {
    rails(f, 0, size);
    sleepers(f, 0, size, nSleep);
  }
  // Switch k > 0 runs from track k-1 to track k (the second one wraps from track 1 back to track 0).
  for (let k = 0; k < depth - 1; k++) {
    const from = tracks[k]!;
    const to = tracks[(k + 1) % 2]!;
    const xa = switchAt[k]! + (k * size) / 2;
    const len = size * 0.45;
    const lift = k === 0 ? 0 : size; // track 1 -> track 0 goes down through the bottom edge
    const f = (x: number) => {
      const t = smooth(Math.min(1, Math.max(0, (x - xa) / len)));
      return (1 - t) * from(x) + t * (to(x) + lift);
    };
    rails(f, xa, xa + len);
    sleepers(f, xa + len * 0.3, xa + len, Math.round(nSleep * 0.3));
  }
  return wrap(out, size);
};

// ---------- quilt ----------

type Piece = (n: number) => Poly[];
const P = (...pts: number[][]): Poly => pts.map(([x, y]): Pt => [x!, y!]);

// Each piecing in the unit block; n (1 or 2) is the level of detail.
const PIECES: Piece[] = [
  // half-square triangles, n x n of them
  (n) => {
    const out: Poly[] = [];
    for (let i = 1; i < n; i++) out.push(P([i / n, 0], [i / n, 1]), P([0, i / n], [1, i / n]));
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(P([i / n, (j + 1) / n], [(i + 1) / n, j / n]));
    return out;
  },
  // pinwheel: four blades turning around the centre
  (n) => {
    const out: Poly[] = [P([0.5, 0], [0.5, 1]), P([0, 0.5], [1, 0.5])];
    const blade: Poly = n > 1 ? P([0.5, 0.5], [0, 0], [0.5, 0]) : P([0.5, 0.5], [0, 0]);
    for (let k = 0; k < 4; k++) out.push(rotQ(blade, k));
    return out;
  },
  // nine-patch, with the corner patches split at detail
  (n) => {
    const out: Poly[] = [];
    for (const v of [1 / 3, 2 / 3]) out.push(P([v, 0], [v, 1]), P([0, v], [1, v]));
    if (n > 1)
      for (const [a, b] of [
        [0, 0],
        [2, 0],
        [0, 2],
        [2, 2],
      ] as const)
        out.push(P([a / 3, b / 3], [(a + 1) / 3, (b + 1) / 3]));
    return out;
  },
  // flying geese: rows of triangles pointing up
  (n) => {
    const rows = 2 * n;
    const out: Poly[] = [];
    for (let i = 0; i < rows; i++) {
      const a = i / rows;
      const b = (i + 1) / rows;
      if (i > 0) out.push(P([0, a], [1, a]));
      out.push(P([0, b], [0.5, a], [1, b]));
    }
    return out;
  },
  // log cabin: a centre square and strips that turn around it
  (n) => {
    const r = n > 1 ? [0.1, 0.22, 0.34, 0.5] : [0.12, 0.3, 0.5];
    const out: Poly[] = [];
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i]!;
      const b = r[i + 1]!;
      out.push(P([0.5 - a, 0.5 - a], [0.5 + a, 0.5 - a], [0.5 + a, 0.5 + a], [0.5 - a, 0.5 + a], [0.5 - a, 0.5 - a]));
      out.push(P([0.5 - a, 0.5 - a], [0.5 - a, 0.5 - b]), P([0.5 + a, 0.5 - a], [0.5 + b, 0.5 - a]));
      out.push(P([0.5 + a, 0.5 + a], [0.5 + a, 0.5 + b]), P([0.5 - a, 0.5 + a], [0.5 - b, 0.5 + a]));
    }
    return out;
  },
];

// Quarter turn k times around the block centre.
function rotQ(poly: Poly, k: number): Poly {
  return poly.map(([x, y]) => {
    let p: Pt = [x, y];
    for (let i = 0; i < k; i++) p = [1 - p[1], p[0]];
    return p;
  });
}

// A 3 x 3 grid of blocks with a seeded shift; seams are lines across the whole tile.
// Depth 2 adds detail to the piecing, depth 3 a dashed stitch line inside each block.
export const quilt: Generator = (rnd, depth, size) => {
  const n = 3;
  const b = size / n;
  const sx = (0.1 + rnd() * 0.8) * b;
  const sy = (0.1 + rnd() * 0.8) * b;
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    out.push(P([sx + i * b, 0], [sx + i * b, size]), P([0, sy + i * b], [size, sy + i * b]));
  }
  const detail = depth > 1 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const piece = PIECES[Math.floor(rnd() * PIECES.length)]!;
      const turn = Math.floor(rnd() * 4);
      const ox = sx + i * b;
      const oy = sy + j * b;
      const local = piece(detail).map((p) => rotQ(p, turn));
      if (depth > 2) {
        // Dashed stitch: a square inset from the block edge, cut into dashes.
        const m = 0.07;
        const dash = 1 / 7;
        for (let s = 0; s < 4; s++)
          for (let d = 0; d < 7; d++) {
            const a = m + (1 - 2 * m) * d * dash;
            const c = m + (1 - 2 * m) * (d + 0.5) * dash;
            local.push(rotQ(P([a, m], [c, m]), s));
          }
      }
      for (const p of local) out.push(p.map(([x, y]): Pt => [ox + x * b, oy + y * b]));
    }
  }
  return wrap(out, size);
};

// ---------- lanterns ----------

const mod = (v: number, m: number) => ((v % m) + m) % m;

const ellipse = (cx: number, cy: number, rx: number, ry: number, k = 24): Poly =>
  Array.from({ length: k + 1 }, (_, i): Pt => [cx + rx * Math.sin((TAU * i) / k), cy - ry * Math.cos((TAU * i) / k)]);

// Two strings sag between pins, one pin per tile width, so each string meets itself across the edge.
// Lanterns hang from the strings: cap, rounded body, ribs (vertical or horizontal), cap, tassel.
// Depth adds ribs.
export const lanterns: Generator = (rnd, depth, size) => {
  const out: Poly[] = [];
  const sag = size * 0.08;
  const y0 = rnd() * size;
  const px = (0.1 + rnd() * 0.8) * size;
  for (let s = 0; s < 2; s++) {
    const base = mod(y0 + (s * size) / 2, size);
    const pin = px + (s * size) / 2;
    const str = (x: number) => base + sag * Math.abs(Math.sin((Math.PI * (x - pin)) / size));
    out.push(Array.from({ length: 41 }, (_, i): Pt => [(size * i) / 40, str((size * i) / 40)]));
    const m = 2;
    for (let j = 0; j < m; j++) {
      const cx = mod(pin + ((j + 0.5) * size) / m + (rnd() - 0.5) * size * 0.08, size); // wrap() shifts by one tile only
      const top = str(cx);
      const rx = size * (0.07 + rnd() * 0.03);
      const ry = size * (0.08 + rnd() * 0.03);
      const vertical = rnd() < 0.5;
      const cord = size * (0.03 + rnd() * 0.04);
      const capW = rx * 0.45;
      const capH = size * 0.02;
      const cy = top + cord + capH + ry * 0.95;
      out.push([
        [cx, top],
        [cx, top + cord],
      ]);
      // Caps are open boxes that meet the body.
      const yt = top + cord;
      const yb = cy + ry * 0.95 + capH;
      out.push(P([cx - capW, cy - ry * 0.95], [cx - capW, yt], [cx + capW, yt], [cx + capW, cy - ry * 0.95]));
      out.push(P([cx - capW, cy + ry * 0.95], [cx - capW, yb], [cx + capW, yb], [cx + capW, cy + ry * 0.95]));
      out.push(ellipse(cx, cy, rx, ry));
      const ribs = 2 * depth - 1;
      for (let r = 1; r <= ribs; r++) {
        const v = -1 + (2 * r) / (ribs + 1);
        if (vertical) {
          // Meridian: half an ellipse of width rx * v.
          if (Math.abs(v) < 1e-9) out.push(P([cx, cy - ry], [cx, cy + ry]));
          else
            out.push(
              Array.from({ length: 13 }, (_, i): Pt => [
                cx + rx * v * Math.sin((Math.PI * i) / 12),
                cy - ry * Math.cos((Math.PI * i) / 12),
              ]),
            );
        } else {
          // Parallel: a chord bowed downward, as seen slightly from above.
          const y = cy + ry * v;
          const w = rx * Math.sqrt(1 - v * v);
          out.push(Array.from({ length: 9 }, (_, i): Pt => [cx - w + (2 * w * i) / 8, y + ry * 0.12 * Math.sin((Math.PI * i) / 8)]));
        }
      }
      // Tassel: a short cord, then fanned threads.
      const tl = size * 0.06;
      out.push(P([cx, yb], [cx, yb + tl * 0.35]));
      for (const d of [-1, 0, 1]) out.push(P([cx, yb + tl * 0.35], [cx + d * capW * 0.6, yb + tl]));
    }
  }
  return wrap(out, size);
};
