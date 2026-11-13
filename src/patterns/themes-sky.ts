// Theme kinds: clouds, moons (phases across the tile) and storm (rain and lightning).
// All live on a torus, so the tile repeats with no seam.
import { wrap, type Generator, type Poly, type Pt } from './util.ts';

export const THEME_SKY_MAX_DEPTH = { clouds: 3, moons: 3, storm: 3 } as const;

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): Poly =>
  Array.from({ length: n + 1 }, (_, i): Pt => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });

// ---------- clouds ----------

// One cumulus at base centre (x, y), y down: k round bumps along the top (the outer envelope of
// circles), a flat base. The end bumps sit on the base so the outline closes with no step.
function cloud(x: number, y: number, w: number, h: number, k: number, rnd: () => number): { outline: Poly; fold: Poly } {
  const bumps: { c: number; lift: number; r: number }[] = [];
  const re = w / (2 * k) + w * 0.04;
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? 0.5 : i / (k - 1);
    const end = i === 0 || i === k - 1;
    const r = end ? re : re * (1.1 + rnd() * 0.35);
    const lift = end ? 0 : Math.max(0, h - r) * Math.sin(Math.PI * t) * (0.7 + rnd() * 0.3);
    bumps.push({ c: -w / 2 + re + (w - 2 * re) * t, lift, r });
  }
  const top = (u: number) =>
    Math.max(0, ...bumps.map((b) => (Math.abs(u - b.c) < b.r ? b.lift + Math.sqrt(b.r * b.r - (u - b.c) ** 2) : 0)));
  const N = 8 * k;
  const outline: Poly = Array.from({ length: N + 1 }, (_, i): Pt => {
    const u = -w / 2 + (w * i) / N;
    return [x + u, y - top(u)];
  });
  outline.push(outline[0]!);
  // Fold: a short inner arc under the tallest middle bump, like the shade of a puff.
  const m = bumps[Math.floor(k / 2)]!;
  const fold = arc(x + m.c, y - m.lift, m.r * 0.6, m.r * 0.6, Math.PI * 0.15, Math.PI * 0.85, 6);
  return { outline, fold };
}

// Two offset rows of two clouds; depth 2 adds a fold in each, depth 3 a small cloudlet in each gap.
export const clouds: Generator = (rnd, depth, size) => {
  const n = 2;
  const cw = size / n;
  const sx = rnd() * cw;
  const sy = (0.1 + rnd() * 0.3) * cw;
  const out: Poly[] = [];
  const folds: Poly[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const w = cw * (0.6 + rnd() * 0.3);
      const h = Math.min(w * (0.38 + rnd() * 0.12), cw * 0.42);
      const k = 3 + Math.floor(rnd() * 2);
      const p = cloud((c + (r % 2) * 0.5) * cw + sx, (r + 0.75) * cw + sy, w, h, k, rnd);
      out.push(p.outline);
      folds.push(p.fold);
    }
  }
  if (depth >= 2) out.push(...folds);
  if (depth >= 3)
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        out.push(cloud((c + 0.5 + (r % 2) * 0.5) * cw + sx, (r + 0.3) * cw + sy, cw * 0.28, cw * 0.11, 2, rnd).outline);
  return wrap(out, size);
};

// ---------- moons ----------

// Lit part of the moon at phase phi (0 new, PI full, 2 PI new again): the limb half circle plus
// the terminator, a half ellipse of x radius r cos(phi). Waning moons are lit on the left.
export function moonPhase(cx: number, cy: number, r: number, phi: number): Poly {
  const s = phi <= Math.PI ? 1 : -1;
  const e = Math.cos(phi);
  const n = 12;
  const limb = arc(cx, cy, s * r, r, -Math.PI / 2, Math.PI / 2, n);
  const term = arc(cx, cy, s * e * r, r, Math.PI / 2, -Math.PI / 2, n).slice(1, -1);
  return [...limb, ...term, limb[0]!];
}

const star = (x: number, y: number, a: number): Poly[] => [
  [
    [x - a, y],
    [x + a, y],
  ],
  [
    [x, y - a],
    [x, y + a],
  ],
];

// A 3 x 3 grid; the phase advances in reading order from a crescent through full to a waning
// crescent. Depth 2 and 3 add small cross stars at some cell corners.
export const moons: Generator = (rnd, depth, size) => {
  const n = 3;
  const cw = size / n;
  const sx = rnd() * cw;
  const sy = rnd() * cw;
  const r = cw * (0.26 + rnd() * 0.06);
  const flip = rnd() < 0.5 ? -1 : 1;
  const out: Poly[] = [];
  for (let i = 0; i < n * n; i++) {
    const phi = Math.PI * (0.3 + (1.4 * i) / (n * n - 1));
    const m = moonPhase(0, 0, r, phi).map(([x, y]): Pt => [sx + ((i % n) + 0.5) * cw + flip * x, sy + (Math.floor(i / n) + 0.5) * cw + y]);
    out.push(m);
  }
  const corners = Array.from({ length: n * n }, (_, i) => i);
  for (let i = corners.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [corners[i], corners[j]] = [corners[j]!, corners[i]!];
  }
  const stars = depth >= 3 ? 5 : depth >= 2 ? 2 : 0;
  for (const i of corners.slice(0, stars)) {
    const jx = (rnd() - 0.5) * cw * 0.1;
    const jy = (rnd() - 0.5) * cw * 0.1;
    out.push(...star(sx + (i % n) * cw + jx, sy + Math.floor(i / n) * cw + jy, cw * 0.06));
  }
  return wrap(out, size);
};

// ---------- storm ----------

const segDist = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};

// Slanted rain on a jittered grid and `depth` zigzag bolts; rain near a bolt is left out so the
// bolts read clearly.
export const storm: Generator = (rnd, depth, size) => {
  const slant = 0.25 + rnd() * 0.15; // from vertical
  const nb = 3;
  const bx0 = rnd() * size;
  const bolts: Poly[] = [];
  for (let b = 0; b < nb; b++) {
    const L = size * (0.38 + rnd() * 0.12);
    const w = size * 0.05;
    const x0 = bx0 + (b * size) / nb + (rnd() - 0.5) * size * 0.08;
    const y0 = rnd() * size;
    const segs = 4 + Math.floor(rnd() * 2);
    bolts.push(
      Array.from({ length: segs + 1 }, (_, j): Pt => {
        const y = (L * j) / segs;
        const zig = j === 0 || j === segs ? 0 : (j % 2 ? 1 : -1) * w * (0.7 + rnd() * 0.6);
        return [x0 - y * Math.tan(slant) * 0.6 + zig, y0 + y];
      }),
    );
  }
  const used = bolts.slice(0, depth);
  const g = 4 + 2 * depth;
  const cell = size / g;
  const len = cell * (0.55 + rnd() * 0.2);
  const dx = Math.sin(slant) * len;
  const dy = Math.cos(slant) * len;
  const rain: Poly[] = [];
  for (let i = 0; i < g; i++) {
    for (let j = 0; j < g; j++) {
      const x = (j + 0.5 + (rnd() - 0.5) * 0.5 + (i % 2) * 0.5) * cell;
      const y = (i + 0.5 + (rnd() - 0.5) * 0.4) * cell;
      const mid: Pt = [x, y];
      // Torus distance: test the bolt and its shifted copies.
      const near = used.some((poly) =>
        [-size, 0, size].some((ox) =>
          [-size, 0, size].some((oy) =>
            poly.some((p, k) => k > 0 && segDist(mid, [poly[k - 1]![0] + ox, poly[k - 1]![1] + oy], [p[0] + ox, p[1] + oy]) < cell * 0.9),
          ),
        ),
      );
      if (!near)
        rain.push([
          [x + dx / 2, y - dy / 2],
          [x - dx / 2, y + dy / 2],
        ]);
    }
  }
  return wrap([...used, ...rain], size);
};
