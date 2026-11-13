// Theme kinds: seigaiha waves, rain, and stacked mountain ridges. All live on a torus.
import { simplify } from '../simplify.ts';
import { TAU, wrap, type Generator, type Poly, type Pt, type Rng } from './util.ts';

export const THEME_WATER_MAX_DEPTH = { seigaiha: 3, rain: 4, ridges: 4 } as const;

// Seigaiha: rows of fans (upper half-disks of radius R), m fans per row, rows R/2 apart,
// odd rows shifted by R. A lower row is nearer, so it hides the rows above it.
export function seigaihaParts(rnd: Rng, depth: number, size: number): { R: number; centers: Pt[]; arcs: { c: Pt; poly: Poly }[] } {
  // ponytail: depth 3 keeps the depth 2 fans and adds a ring; three fans per row would pass 9000 path characters.
  const m = depth === 1 ? 1 : 2;
  const R = size / (2 * m);
  const n = 3 + Math.floor(rnd() * 2) + (depth === 3 ? 1 : 0);
  const x0 = rnd() * 2 * R;
  const y0 = rnd() * R;
  const centers: Pt[] = [];
  for (let j = 0; j < 4 * m; j++) for (let i = 0; i < m; i++) centers.push([x0 + i * 2 * R + (j % 2) * R, y0 + (j * R) / 2]);
  // The nearer fans that can cover a fan: one row down (+-R) and two rows down (same x).
  const front = (c: Pt): Pt[] => [
    [c[0] - R, c[1] + R / 2],
    [c[0] + R, c[1] + R / 2],
    [c[0], c[1] + R],
  ];
  const arcs: { c: Pt; poly: Poly }[] = [];
  for (const c of centers) {
    const cover = front(c);
    const hidden = ([x, y]: Pt) => cover.some(([fx, fy]) => y < fy && Math.hypot(x - fx, y - fy) < R);
    for (let k = n; k >= 1; k--) {
      if (k < n && rnd() < 0.12) continue; // a ring left out here and there, never the outline
      const r = (R * k) / n;
      const at = (t: number): Pt => [c[0] + r * Math.cos(t), c[1] - r * Math.sin(t)];
      const steps = 90;
      let run: Poly | null = null;
      let prev = 0;
      for (let s = 0; s <= steps; s++) {
        const t = (Math.PI * s) / steps;
        const vis = !hidden(at(t));
        if (vis && !run) {
          let [a, b] = s === 0 ? [t, t] : [prev, t]; // a hidden, b visible
          for (let it = 0; it < 30 && s > 0; it++) {
            const mid = (a + b) / 2;
            if (hidden(at(mid))) a = mid;
            else b = mid;
          }
          run = [at(b)];
        } else if (vis && run) run.push(at(t));
        else if (!vis && run) {
          let [a, b] = [prev, t]; // a visible, b hidden
          for (let it = 0; it < 30; it++) {
            const mid = (a + b) / 2;
            if (hidden(at(mid))) b = mid;
            else a = mid;
          }
          run.push(at(a));
          if (run.length >= 2) arcs.push({ c, poly: simplify(run, 0.5) });
          run = null;
        }
        prev = t;
      }
      if (run && run.length >= 2) arcs.push({ c, poly: simplify(run, 0.5) });
    }
  }
  return { R, centers, arcs };
}

export const seigaiha: Generator = (rnd, depth, size) =>
  wrap(
    seigaihaParts(rnd, depth, size).arcs.map((a) => a.poly),
    size,
  );

// Rain: one stroke per cell of a staggered grid; every shape stays inside its own cell, so none cross.
export const rain: Generator = (rnd, depth, size) => {
  const nx = 4 + 2 * depth;
  const ny = 2 + depth;
  const cw = size / nx;
  const ch = size / ny;
  const a = ((60 + rnd() * 20) * Math.PI) / 180;
  const side = rnd() < 0.5 ? -1 : 1;
  const ux = side * Math.cos(a);
  const uy = Math.sin(a);
  const stagger = 0.3 + rnd() * 0.4;
  const x0 = rnd() * size;
  const y0 = rnd() * size;
  const pad = 1;
  const out: Poly[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = (x0 + (i + ((j * stagger) % 1)) * cw) % size;
      const cy = y0 + j * ch;
      const roll = rnd();
      const splash = roll < 0.15;
      const streak = roll > 0.9;
      const r = Math.min(3, (cw - 2 * pad) / 2);
      const room = ch - 2 * pad - (splash ? r + 1.5 : 0);
      const maxL = Math.min(room / uy, (cw - 2 * pad) / Math.abs(ux));
      const L = maxL * (streak ? 0.95 : 0.4 + rnd() * 0.3);
      // Shape box relative to the stroke start; then a random place for it inside the cell.
      const dx = L * ux;
      const dy = L * uy;
      const bx0 = Math.min(0, dx, splash ? dx - r : 0);
      const bx1 = Math.max(0, dx, splash ? dx + r : 0);
      const by1 = dy + (splash ? 1.5 + r : 0);
      const sx = cx + pad - bx0 + rnd() * Math.max(0, cw - 2 * pad - (bx1 - bx0));
      const sy = cy + pad + rnd() * Math.max(0, ch - 2 * pad - by1);
      out.push([
        [sx, sy],
        [sx + dx, sy + dy],
      ]);
      if (splash) {
        const [ex, ey] = [sx + dx, sy + dy + 1.5 + r]; // arc centre: its top sits 1.5 px under the drop
        out.push(
          Array.from({ length: 7 }, (_, k): Pt => {
            const t = Math.PI * (0.2 + (0.6 * k) / 6);
            return [ex + r * Math.cos(t), ey - r * Math.sin(t)];
          }),
        );
      }
    }
  }
  return wrap(out, size);
};

// Ridges: B skylines, base lines size/B apart; each one is lifted by a periodic profile and
// clamped below the ridge behind it (the one above), the first one with a small enough lift.
export function ridgeLines(rnd: Rng, depth: number, size: number): { ridges: Poly[]; hatches: Poly[]; gap: number } {
  const B = depth + 1;
  const h = size / B;
  const gap = 2;
  const N = 96;
  const y0 = rnd() * h;
  const xs = Array.from({ length: N + 1 }, (_, i) => (i * size) / N);
  const ys: number[][] = [];
  for (let k = 0; k < B; k++) {
    const waves = Array.from({ length: 3 }, () => ({ f: 1 + Math.floor(rnd() * 4), a: rnd(), p: rnd() * TAU }));
    const peaks = Array.from({ length: 2 + Math.floor(rnd() * 3) }, () => ({
      x: rnd() * size,
      w: size * (0.12 + rnd() * 0.14),
      a: 0.6 + rnd(),
    }));
    const prof = xs.map((x) => {
      let v = waves.reduce((s, w) => s + w.a * (1 + Math.sin((TAU * w.f * x) / size + w.p)), 0) * 0.3;
      for (const p of peaks) {
        const d = Math.abs(((x - p.x + 1.5 * size) % size) - size / 2);
        v += p.a * Math.max(0, 1 - d / p.w);
      }
      return v;
    });
    const lo = Math.min(...prof);
    const hi = Math.max(...prof);
    const A = k === 0 ? h - gap : h * (0.9 + rnd() * 0.6);
    const base = y0 + (k + 0.8) * h;
    ys.push(prof.map((v) => base - (A * (v - lo)) / (hi - lo)));
  }
  for (let k = 1; k < B; k++) ys[k] = ys[k]!.map((y, i) => Math.max(y, ys[k - 1]![i]! + gap));
  const ridges = ys.map((row) =>
    simplify(
      row.map((y, i): Pt => [xs[i]!, y]),
      0.3,
    ),
  );
  // Hatches on the right slope of the highest point of some ridges, only where there is room below.
  const hatches: Poly[] = [];
  for (let k = 0; k < B; k++) {
    const row = ys[k]!;
    const below = k + 1 < B ? ys[k + 1]! : ys[0]!.map((y) => y + size);
    const top = row.indexOf(Math.min(...row));
    for (let s = 1; s <= 3; s++) {
      const i = (top + 2 * s) % N;
      const sx = xs[i]! + 0.5; // off the sample, so a hatch never starts on the tile edge
      const sy = row[i]! + 2;
      const ex = sx - 2;
      const ey = sy + 5;
      const j = Math.max(0, Math.floor(((sx - 2) / size) * N));
      if (ey + 1.5 < Math.min(below[i]!, below[j]!) && rnd() < 0.8)
        hatches.push([
          [sx, sy],
          [ex, ey],
        ]);
    }
  }
  return { ridges, hatches, gap };
}

export const ridges: Generator = (rnd, depth, size) => {
  const { ridges: r, hatches } = ridgeLines(rnd, depth, size);
  return wrap([...r, ...hatches], size);
};
