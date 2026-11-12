// Shared helpers for the pattern generators: PRNG, tile placement, periodic clipping.

export type Pt = readonly [number, number];
export type Poly = Pt[];
export type Rng = () => number;
// One kind = one generator: seeded rng, clamped depth, tile size in px -> polylines inside [0, size].
export type Generator = (rnd: Rng, depth: number, size: number) => Poly[];

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unit-square coords mapped as is into [m, size - m], m = margin * size.
export function place(polys: Poly[], size: number, margin: number): Poly[] {
  const m = margin * size;
  const s = size - 2 * m;
  return polys.map((poly) => poly.map(([x, y]): Pt => [m + x * s, m + y * s]));
}

// Free coords scaled to fit their bounding box into [m, size - m], centred.
export function fit(polys: Poly[], size: number, margin: number): Poly[] {
  const m = margin * size;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const poly of polys) {
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const avail = size - 2 * m;
  const w = x1 - x0;
  const h = y1 - y0;
  const s = avail / Math.max(w, h, 1e-12);
  const ox = m + (avail - w * s) / 2 - x0 * s;
  const oy = m + (avail - h * s) / 2 - y0 * s;
  return polys.map((poly) => poly.map(([x, y]): Pt => [Math.min(size, Math.max(0, ox + x * s)), Math.min(size, Math.max(0, oy + y * s))]));
}

// Periodic tiling: pixel geometry that crosses the tile edge is drawn again shifted by
// +-size and everything is clipped to [0, size], so what leaves one edge enters the opposite one.
export function wrap(polys: Poly[], size: number): Poly[] {
  const out: Poly[] = [];
  for (const poly of polys) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of poly) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        if (x0 + ox > size || x1 + ox < 0 || y0 + oy > size || y1 + oy < 0) continue;
        clip(
          poly.map(([x, y]): Pt => [x + ox, y + oy]),
          size,
          out,
        );
      }
    }
  }
  return out;
}

// Liang-Barsky per segment; consecutive inside parts are joined into one polyline.
function clip(poly: Poly, size: number, out: Poly[]): void {
  const c = (v: number) => Math.min(size, Math.max(0, v));
  let run: Poly | null = null;
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1]!;
    const [bx, by] = poly[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    for (const [p, q] of [
      [-dx, ax],
      [dx, size - ax],
      [-dy, ay],
      [dy, size - ay],
    ] as const) {
      if (p === 0) {
        if (q < 0) t0 = 2;
      } else if (p < 0) t0 = Math.max(t0, q / p);
      else t1 = Math.min(t1, q / p);
    }
    if (t0 >= t1) {
      run = null;
      continue;
    }
    if (!run || t0 > 0) {
      run = [[c(ax + t0 * dx), c(ay + t0 * dy)]];
      out.push(run);
    }
    run.push([c(ax + t1 * dx), c(ay + t1 * dy)]);
    if (t1 < 1) run = null;
  }
}

// Drops points closer than step to the last kept one (curves are sampled finely, then thinned).
export function thin(poly: Poly, step: number): Poly {
  const first = poly[0];
  const last = poly[poly.length - 1];
  if (!first || !last) return poly;
  const out: Poly = [first];
  let [px, py] = first;
  for (const p of poly.slice(1, -1)) {
    if (Math.hypot(p[0] - px, p[1] - py) >= step) {
      out.push(p);
      [px, py] = p;
    }
  }
  out.push(last);
  return out;
}

export const TAU = 2 * Math.PI;
