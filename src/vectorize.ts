// Binary edge map to simplified polylines in tile coordinates. Pure array code, runs in the browser and in Node.

import type { Pt } from './patterns/util.ts';

// 4-connected first, then diagonals: the walk prefers straight steps.
const NEIGHBORS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]] as const;

export function chains(map: Uint8Array, width: number, height: number): Pt[][] {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && map[y * width + x] === 1;
  const seen = new Uint8Array(width * height);
  const degree = (x: number, y: number) => NEIGHBORS.filter(([dx, dy]) => on(x + dx, y + dy)).length;
  const out: Pt[][] = [];
  const walk = (x: number, y: number) => {
    const chain: Pt[] = [];
    for (;;) {
      seen[y * width + x] = 1;
      chain.push([x + 0.5, y + 0.5]);
      const next = NEIGHBORS.find(([dx, dy]) => on(x + dx, y + dy) && seen[(y + dy) * width + x + dx] === 0);
      if (!next) break;
      x += next[0];
      y += next[1];
    }
    out.push(chain);
  };
  for (const endpointsOnly of [true, false]) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (on(x, y) && seen[y * width + x] === 0 && (!endpointsOnly || degree(x, y) === 1)) walk(x, y);
      }
    }
  }
  return out;
}

function segmentDistance([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function simplify(poly: readonly Pt[], tolerance: number): Pt[] {
  if (tolerance <= 0 || poly.length < 3) return [...poly];
  const keep = new Uint8Array(poly.length);
  keep[0] = 1;
  keep[poly.length - 1] = 1;
  const stack: [number, number][] = [[0, poly.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop() ?? [0, 0];
    let worst = -1;
    let far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistance(poly[i] as Pt, poly[a] as Pt, poly[b] as Pt);
      if (d > far) {
        far = d;
        worst = i;
      }
    }
    if (worst >= 0 && far > tolerance) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return poly.filter((_, i) => keep[i] === 1);
}

export interface TraceOptions {
  readonly size: number;
  readonly tolerance: number;
  readonly minLength: number;
}

const length = (poly: readonly Pt[]) =>
  poly.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - (poly[i]?.[0] ?? x), y - (poly[i]?.[1] ?? y)), 0);

export function vectorize(map: Uint8Array, width: number, height: number, o: TraceOptions): Pt[][] {
  const s = o.size / Math.max(width, height);
  const ox = (o.size - width * s) / 2;
  const oy = (o.size - height * s) / 2;
  return chains(map, width, height)
    .map((c) => c.map(([x, y]): Pt => [ox + x * s, oy + y * s]))
    .filter((c) => c.length >= 2 && length(c) >= o.minLength)
    .map((c) => simplify(c, o.tolerance));
}
