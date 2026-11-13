// Theme kinds from the wild: leaves, river, thorns and nest.
// All live on a torus, so the tile repeats with no seam.
import { mulberry32, TAU, wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const THEME_WILD_MAX_DEPTH = { leaves: 4, river: 3, thorns: 3, nest: 3 } as const;

const rot = (pts: Poly, a: number, cx: number, cy: number): Poly => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]): Pt => [cx + x * c - y * s, cy + x * s + y * c]);
};

// A detail rng per element: the layout draws stay the same at every depth.
const fork = (rnd: Rng): Rng => mulberry32(Math.floor(rnd() * 2 ** 32));

// ---------- leaves ----------

// One leaf in local coordinates: base at x = -len/2, tip at x = len/2, both pointed.
function leaf(len: number, half: number, veins: number): Poly[] {
  const K = 12;
  const w = (t: number) => half * Math.pow(Math.sin(Math.PI * t), 0.8);
  const side = (s: number): Poly => Array.from({ length: K + 1 }, (_, i): Pt => [len * (i / K - 0.5), s * w(i / K)]);
  const top = side(-1);
  const out: Poly[] = [
    [...top, ...side(1).reverse().slice(1)],
    [
      [-0.62 * len, 0],
      [0.42 * len, 0],
    ],
  ];
  const ang = 0.7; // from the midrib, toward the tip
  for (let i = 0; i < veins; i++) {
    const t = 0.18 + (0.55 * (i + 0.5)) / veins;
    const x0 = len * (t - 0.5);
    for (const s of [1, -1]) {
      // Walk out until 75% of the half width at the end point.
      let d = 0;
      while (d < half && d * Math.sin(ang) < 0.75 * w(t + (d * Math.cos(ang)) / len)) d += 0.25;
      out.push([
        [x0, 0],
        [x0 + d * Math.cos(ang), s * d * Math.sin(ang)],
      ]);
    }
  }
  return out;
}

// One leaf per cell of a 3 by 3 grid (rows offset by half a cell); each leaf fits in its cell, so none overlap.
export const leaves: Generator = (rnd, depth, size) => {
  const n = 3;
  const c = size / n;
  const sx = rnd() * c;
  const sy = rnd() * c;
  const out: Poly[] = [];
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      const len = c * (0.55 + rnd() * 0.25);
      const half = len * (0.2 + rnd() * 0.08);
      const reach = 0.62 * len; // stem end, the farthest point from the centre
      const jx = (rnd() - 0.5) * 2 * Math.max(0, c / 2 - reach - 1);
      const jy = (rnd() - 0.5) * 2 * Math.max(0, c / 2 - reach - 1);
      const a = rnd() * TAU;
      const cx = (k + 0.5 + (r % 2) * 0.5) * c + sx + jx;
      const cy = (r + 0.5) * c + sy + jy;
      out.push(...leaf(len, half, depth - 1).map((q) => rot(q, a, cx, cy)));
    }
  }
  return wrap(out, size);
};

// ---------- river ----------

// Two rivers flow left to right; meanders use whole periods, so each river meets itself across the edge.
// Inside the banks two threads braid around sand islands; ripple marks sit on the islands.
export const river: Generator = (rnd, depth, size) => {
  const m = 2;
  const g = (size / m) * 0.55; // bank to bank
  const N = 48;
  const out: Poly[] = [];
  const sx = rnd() * size;
  const sy = rnd() * size;
  for (let j = 0; j < m; j++) {
    const a1 = size * (0.04 + rnd() * 0.03);
    const a2 = size * (0.015 + rnd() * 0.015);
    const p1 = rnd() * TAU;
    const p2 = rnd() * TAU;
    const kb = 2 + Math.floor(rnd() * 2); // braid crossings per tile, halved
    const pb = rnd() * TAU;
    const y0 = sy + (j * size) / m;
    const mid = (x: number) => y0 + a1 * Math.sin((TAU * x) / size + p1) + a2 * Math.sin((2 * TAU * x) / size + p2);
    const line = (f: (x: number) => number): Poly =>
      Array.from({ length: N + 1 }, (_, i): Pt => [sx + (size * i) / N, f(sx + (size * i) / N)]);
    const braid = (x: number) => 0.24 * g * Math.sin((kb * TAU * x) / size + pb);
    out.push(
      line((x) => mid(x) - g / 2),
      line((x) => mid(x) + g / 2),
    );
    out.push(
      line((x) => mid(x) + braid(x)),
      line((x) => mid(x) - braid(x)),
    );
    if (depth < 2) continue;
    // Ripples: small arcs bowed downstream, centred on each island (where the threads are farthest apart).
    const per = depth === 2 ? 1 : 3;
    for (let i = 0; i < 2 * kb; i++) {
      const xi = ((((i + 0.5) * Math.PI - pb) / (kb * TAU)) * size + size * 4) % size;
      for (let q = 0; q < per; q++) {
        const x = xi + (q - (per - 1) / 2) * 0.05 * (size / kb);
        const h = 0.07 * g * (q === (per - 1) / 2 ? 1 : 0.7);
        const y = mid(x);
        out.push([
          [x - h * 0.4, y - h],
          [x + h * 0.2, y - h * 0.5],
          [x + h * 0.4, y],
          [x + h * 0.2, y + h * 0.5],
          [x - h * 0.4, y + h],
        ]);
      }
    }
  }
  return wrap(out, size);
};

// ---------- thorns ----------

// Bramble stems run on the diagonal (one turn each way per tile), so each stem closes on the torus.
// Thorns are open triangles that alternate sides and lean back toward the root.
export const thorns: Generator = (rnd, depth, size) => {
  const m = 2;
  const N = 60;
  const amp = (size / m / Math.SQRT2) * 0.18;
  const tl = (size / m / Math.SQRT2) * 0.2; // thorn length
  const out: Poly[] = [];
  const s0 = rnd() * size;
  for (let j = 0; j < m; j++) {
    const ph1 = rnd() * TAU;
    const ph2 = rnd() * TAU;
    const k2 = 2 + Math.floor(rnd() * 2);
    const off = rnd() * 0.5;
    const c0 = (s0 + (j * size) / m) % size;
    // u along the stem, the bend is across it (perpendicular to the diagonal).
    const at = (u: number): Pt => {
      const v = amp * (Math.sin((TAU * u) / size + ph1) + 0.4 * Math.sin((k2 * TAU * u) / size + ph2));
      return [u + v / Math.SQRT2, c0 + u - v / Math.SQRT2];
    };
    out.push(Array.from({ length: N + 1 }, (_, i) => at((size * i) / N)));
    const nt = 4 + 4 * depth;
    for (let i = 0; i < nt; i++) {
      const u = ((i + off) * size) / nt;
      const [x, y] = at(u);
      const [x1, y1] = at(u + 0.5);
      const l = Math.hypot(x1 - x, y1 - y);
      const tx = (x1 - x) / l;
      const ty = (y1 - y) / l;
      const s = i % 2 === 0 ? 1 : -1;
      const nx = -ty * s;
      const ny = tx * s;
      const b = tl * 0.35; // half base
      out.push([
        [x - tx * b, y - ty * b],
        [x + nx * tl - tx * tl * 0.45, y + ny * tl - ty * tl * 0.45],
        [x + tx * b, y + ty * b],
      ]);
    }
  }
  return wrap(out, size);
};

// ---------- nest ----------

// Two nests per tile on the diagonal. Each ring is short twig arcs laid along an ellipse,
// overlapping like weaving; at depth 3, two or three eggs lie in the bowl.
export const nest: Generator = (rnd, depth, size) => {
  const sx = rnd() * size;
  const sy = rnd() * size;
  const out: Poly[] = [];
  for (let j = 0; j < 2; j++) {
    const a = size * (0.27 + rnd() * 0.03);
    const b = a * (0.6 + rnd() * 0.08);
    const cx = sx + (j * size) / 2;
    const cy = sy + (j * size) / 2;
    const tilt = (rnd() - 0.5) * 0.3;
    const d = fork(rnd);
    const rings = [1, 0.86, 0.72].slice(0, Math.min(3, depth + 1));
    for (const [ri, sc] of rings.entries()) {
      const n = Math.round(14 * sc);
      const a0 = d() * TAU;
      for (let i = 0; i < n; i++) {
        const t0 = a0 + (TAU * (i + (d() - 0.5) * 0.3)) / n;
        const span = (TAU / n) * (1.25 + d() * 0.2);
        const r = sc * (1 + (d() - 0.5) * 0.06) - (i % 2) * 0.03; // alternate twigs a hair inward
        const twig: Poly = Array.from({ length: 5 }, (_, k): Pt => {
          const t = t0 + (span * k) / 4;
          const bow = 1 + 0.03 * Math.sin((Math.PI * k) / 4) * (ri % 2 ? -1 : 1);
          return [a * r * bow * Math.cos(t), b * r * bow * Math.sin(t)];
        });
        out.push(rot(twig, tilt, cx, cy));
      }
    }
    if (depth < 3) continue;
    const ne = 2 + Math.floor(d() * 2);
    const ex = a * 0.11;
    const ey = a * 0.15;
    for (let e = 0; e < ne; e++) {
      const ox = (e - (ne - 1) / 2) * a * 0.26;
      const oy = (d() - 0.5) * b * 0.12;
      const ea = (d() - 0.5) * 0.8;
      // Egg: an ellipse a little narrower at the top.
      const egg: Poly = Array.from({ length: 17 }, (_, k): Pt => {
        const t = (TAU * k) / 16;
        const s = Math.sin(t);
        return [ex * Math.cos(t) * (1 - 0.18 * Math.max(0, -s)), ey * s];
      });
      out.push(rot(rot(egg, ea, ox, oy), tilt, cx, cy));
    }
  }
  return wrap(out, size);
};
