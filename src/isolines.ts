// Edge-snapped isolines: contour lines of the smoothed brightness, kept only where the gradient is strong.
// Smooth sub-pixel curves with the placement of an edge detector, no pixel linking. Pure array code.
// Coordinates are in pixels, pixel (x, y) has its center at (x + 0.5, y + 0.5).

import type { Pt } from './patterns/util.ts';
import { gaussianBlur, gradient, type Gray } from './trace.ts';
import { simplify } from './vectorize.ts';

export interface IsoOptions {
  readonly levels: number;
  readonly blur: number;
  readonly strength: number;
  readonly minLength: number;
  readonly tolerance: number;
  readonly size: number;
}

/** `count` levels between the k-means clusters of the 256-bin histogram, ascending. */
export function chooseLevels(g: Gray, count: number): number[] {
  const hist = new Float64Array(256);
  for (const v of g.data) hist[Math.min(255, Math.max(0, Math.round(v)))]! += 1;
  const k = Math.min(8, Math.max(1, Math.round(count))) + 1;
  const total = g.data.length;
  // Deterministic start: the bins at evenly spaced quantiles.
  const centers: number[] = [];
  for (let i = 0; i < k; i++) {
    const target = ((i + 0.5) / k) * total;
    let acc = 0;
    let b = 0;
    while (b < 255 && acc + hist[b]! <= target) acc += hist[b++]!;
    centers.push(b);
  }
  for (let round = 0; round < 20; round++) {
    const sum = new Float64Array(k);
    const n = new Float64Array(k);
    for (let b = 0; b < 256; b++) {
      if (hist[b] === 0) continue;
      let best = 0;
      for (let c = 1; c < k; c++) if (Math.abs(b - centers[c]!) < Math.abs(b - centers[best]!)) best = c;
      sum[best]! += b * hist[b]!;
      n[best]! += hist[b]!;
    }
    let moved = false;
    for (let c = 0; c < k; c++) {
      if (n[c] === 0) continue; // an empty cluster keeps its center
      const m = sum[c]! / n[c]!;
      if (m !== centers[c]) moved = true;
      centers[c] = m;
    }
    if (!moved) break;
  }
  const uniq = [...new Set(centers)].sort((a, b) => a - b);
  return uniq.slice(1).map((c, i) => (uniq[i]! + c) / 2);
}

/** Marching squares on the pixel-center grid: open chains end on the border, loops repeat their first point. */
export function isolines(g: Gray, level: number): Pt[][] {
  const { width: w, height: h, data } = g;
  const v = (x: number, y: number) => data[y * w + x]!;
  // Edge ids: 2 * (y * w + x) is the edge (x,y)-(x+1,y), plus 1 is the edge (x,y)-(x,y+1).
  const pts = new Map<number, Pt>();
  const adj = new Map<number, number[]>();
  const point = (id: number): number => {
    if (!pts.has(id)) {
      const cell = id >> 1;
      const x = cell % w;
      const y = (cell - x) / w;
      const a = v(x, y);
      const b = id & 1 ? v(x, y + 1) : v(x + 1, y);
      const t = (level - a) / (b - a);
      pts.set(id, id & 1 ? [x + 0.5, y + t + 0.5] : [x + t + 0.5, y + 0.5]);
    }
    return id;
  };
  const link = (p: number, q: number) => {
    adj.set(point(p), [...(adj.get(p) ?? []), q]);
    adj.set(point(q), [...(adj.get(q) ?? []), p]);
  };
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const [a, b, c, d] = [v(x, y), v(x + 1, y), v(x + 1, y + 1), v(x, y + 1)];
      const top = 2 * (y * w + x);
      const left = top + 1;
      const right = 2 * (y * w + x + 1) + 1;
      const bottom = 2 * ((y + 1) * w + x);
      const code = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      const centerUp = (a + b + c + d) / 4 >= level;
      if (code === 1 || code === 14) link(left, top);
      else if (code === 2 || code === 13) link(top, right);
      else if (code === 3 || code === 12) link(left, right);
      else if (code === 4 || code === 11) link(right, bottom);
      else if (code === 6 || code === 9) link(top, bottom);
      else if (code === 7 || code === 8) link(left, bottom);
      else if (code !== 5 && code !== 10) continue;
      // Saddle: the cell average decides which diagonal corners connect.
      else if ((code === 5) === centerUp) {
        link(top, right);
        link(left, bottom);
      } else {
        link(left, top);
        link(right, bottom);
      }
    }
  }
  const seen = new Set<number>();
  const out: Pt[][] = [];
  const walk = (start: number) => {
    const ids = [start];
    seen.add(start);
    for (;;) {
      const next = (adj.get(ids[ids.length - 1]!) ?? []).find((n) => !seen.has(n));
      if (next === undefined) break;
      seen.add(next);
      ids.push(next);
    }
    const line = ids.map((id) => pts.get(id)!);
    if ((adj.get(start) ?? []).length === 2 && ids.length > 2) line.push(line[0]!);
    out.push(line);
  };
  for (const [id, n] of adj) if (n.length === 1 && !seen.has(id)) walk(id);
  for (const id of adj.keys()) if (!seen.has(id)) walk(id);
  return out;
}

function bilinear(mag: Float32Array, w: number, h: number, [px, py]: Pt): number {
  const x = Math.min(w - 1, Math.max(0, px - 0.5));
  const y = Math.min(h - 1, Math.max(0, py - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const m = (xx: number, yy: number) => mag[yy * w + xx] ?? 0;
  return (m(x0, y0) * (1 - fx) + m(x1, y0) * fx) * (1 - fy) + (m(x0, y1) * (1 - fx) + m(x1, y1) * fx) * fy;
}

const isClosed = (l: readonly Pt[]) => l.length > 2 && l[0]![0] === l[l.length - 1]![0] && l[0]![1] === l[l.length - 1]![1];

/** Keeps the runs of vertices on a strong gradient, with Canny-like hysteresis (high `cut`, low 0.4 * cut). */
export function snapToEdges(lines: Pt[][], mag: Float32Array, width: number, height: number, cut: number): Pt[][] {
  const out: Pt[][] = [];
  for (const line of lines) {
    const closed = isClosed(line);
    let pts = closed ? line.slice(0, -1) : line;
    let m = pts.map((p) => bilinear(mag, width, height, p));
    if (closed) {
      const gap = m.findIndex((x) => x < 0.4 * cut);
      if (gap < 0) {
        if (m.some((x) => x >= cut)) out.push(line);
        continue;
      }
      // Start the loop at a weak vertex so no run wraps around.
      pts = [...pts.slice(gap), ...pts.slice(0, gap)];
      m = [...m.slice(gap), ...m.slice(0, gap)];
    }
    let i = 0;
    while (i < pts.length) {
      if (m[i]! < 0.4 * cut) {
        i++;
        continue;
      }
      const start = i;
      let strong = false;
      while (i < pts.length && m[i]! >= 0.4 * cut) if (m[i++]! >= cut) strong = true;
      if (strong && i - start >= 2) out.push(pts.slice(start, i));
    }
  }
  return out;
}

const polyLength = (l: readonly Pt[]) => l.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - l[i]![0], y - l[i]![1]), 0);

export function traceIsolines(g: Gray, o: IsoOptions): Pt[][] {
  const b = gaussianBlur(g, o.blur);
  const { width: w, height: h } = b;
  const mag = gradient(b, 'sobel');
  const perLevel = chooseLevels(b, o.levels).map((level) => isolines(b, level));
  const samples = perLevel.flatMap((ls) => ls.flatMap((l) => l.map((p) => bilinear(mag, w, h, p)))).sort((x, y) => x - y);
  if (samples.length === 0) return [];
  const cut = samples[Math.floor(Math.min(1, Math.max(0, o.strength)) * (samples.length - 1))]!;
  // Coarse 1 px occupancy grid, one bit per level, for dropping near-copies of another level's curve.
  const grid = new Uint8Array(w * h);
  const cellOf = (x: number, y: number) => Math.min(h - 1, Math.max(0, Math.floor(y))) * w + Math.min(w - 1, Math.max(0, Math.floor(x)));
  const kept: Pt[][] = [];
  perLevel.forEach((lines, li) => {
    const bit = 1 << li;
    const pieces = snapToEdges(lines, mag, w, h, cut).filter((p) => polyLength(p) >= o.minLength);
    const near = ([x, y]: Pt) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (grid[cellOf(x + dx, y + dy)]! & ~bit) return true;
      return false;
    };
    const fresh = pieces.filter((p) => p.filter(near).length <= 0.8 * p.length);
    for (const p of fresh) {
      // Mark every half pixel along the piece.
      for (let i = 1; i < p.length; i++) {
        const [ax, ay] = p[i - 1]!;
        const [bx, by] = p[i]!;
        const n = Math.max(1, Math.ceil(2 * Math.hypot(bx - ax, by - ay)));
        for (let k = 0; k <= n; k++) grid[cellOf(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n)]! |= bit;
      }
    }
    kept.push(...fresh);
  });
  const s = o.size / Math.max(w, h);
  const ox = (o.size - w * s) / 2;
  const oy = (o.size - h * s) / 2;
  return kept.map((p) => simplify(p, o.tolerance).map(([x, y]): Pt => [ox + x * s, oy + y * s]));
}
