// Binary edge map to simplified polylines in tile coordinates. Pure array code, runs in the browser and in Node.

import type { Pt } from './patterns/util.ts';
import { clipToTile } from './spacing.ts';

// 4-connected first, then diagonals: the walk prefers straight steps.
const NEIGHBORS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
] as const;

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

import { simplify } from './simplify.ts';

export { simplify };

export interface TraceOptions {
  readonly size: number;
  readonly tolerance: number;
  readonly minLength: number;
  // 'contain' fits the whole image and leaves a blank strip; 'cover' fills the tile and crops the longer axis.
  readonly fit?: 'contain' | 'cover';
}

const length = (poly: readonly Pt[]) =>
  poly.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - (poly[i]?.[0] ?? x), y - (poly[i]?.[1] ?? y)), 0);

// Image pixel coordinates to tile coordinates: tile = offset + pixel * s.
export function tileScale(width: number, height: number, size: number, fit?: 'contain' | 'cover'): { s: number; ox: number; oy: number } {
  const s = size / (fit === 'cover' ? Math.min(width, height) : Math.max(width, height));
  return { s, ox: (size - width * s) / 2, oy: (size - height * s) / 2 };
}

export function vectorize(map: Uint8Array, width: number, height: number, o: TraceOptions): Pt[][] {
  const cover = o.fit === 'cover';
  const { s, ox, oy } = tileScale(width, height, o.size, o.fit);
  return chains(map, width, height)
    .map((c) => c.map(([x, y]): Pt => [ox + x * s, oy + y * s]))
    .flatMap((c) => (cover ? clipToTile(c, o.size) : [c]))
    .filter((c) => c.length >= 2 && length(c) >= o.minLength)
    .map((c) => simplify(c, o.tolerance));
}
