// Pure geometry that controls the white space between repeats of a tile: zoom with toroidal wrap,
// an explicit gap, and a mirror tiling that makes any content seamless.

import type { Pt } from './patterns/util.ts';

type Polys = readonly (readonly Pt[])[];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const copy = (polys: Polys): Pt[][] => polys.map((p) => p.map(([x, y]): Pt => [x, y]));

// Liang-Barsky per segment against [0, size]^2; consecutive inside parts stay one polyline.
// ponytail: same algorithm as the private clip() in patterns/util.ts, which is not exported.
export function clipToTile(poly: readonly Pt[], size: number): Pt[][] {
  const out: Pt[][] = [];
  const c = (v: number) => clamp(v, 0, size);
  let run: Pt[] | null = null;
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
  return out;
}

export function zoomWrap(polys: Polys, size: number, zoom: number): Pt[][] {
  const z = clamp(zoom, 0.25, 4);
  if (z === 1) return copy(polys);
  const h = size / 2;
  const out: Pt[][] = [];
  for (const poly of polys) {
    const p = poly.map(([x, y]): Pt => [h + (x - h) * z, h + (y - h) * z]);
    const xs = p.map(([x]) => x);
    const ys = p.map(([, y]) => y);
    // Every whole-tile shift that brings part of the polyline into the tile.
    for (let i = Math.ceil(-Math.max(...xs) / size); i <= Math.floor((size - Math.min(...xs)) / size); i++) {
      for (let j = Math.ceil(-Math.max(...ys) / size); j <= Math.floor((size - Math.min(...ys)) / size); j++) {
        out.push(
          ...clipToTile(
            p.map(([x, y]): Pt => [x + i * size, y + j * size]),
            size,
          ),
        );
      }
    }
  }
  return out.filter((p) => p.length >= 2);
}

export function withGap(polys: Polys, size: number, gap: number): { polys: Pt[][]; size: number } {
  const g = clamp(gap, 0, size);
  return { polys: polys.map((p) => p.map(([x, y]): Pt => [x + g / 2, y + g / 2])), size: size + g };
}

export function mirrorTile(polys: Polys, size: number): Pt[][] {
  const maps = [
    (x: number, y: number): Pt => [x / 2, y / 2],
    (x: number, y: number): Pt => [size - x / 2, y / 2],
    (x: number, y: number): Pt => [x / 2, size - y / 2],
    (x: number, y: number): Pt => [size - x / 2, size - y / 2],
  ];
  return maps.flatMap((m) => polys.map((p) => p.map(([x, y]) => m(x, y))));
}
