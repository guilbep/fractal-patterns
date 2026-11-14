import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tiling, TILING_LABELS, type TilingId } from './tilings.ts';
import type { Pt } from './util.ts';

const IDS = Object.keys(TILING_LABELS) as TilingId[];

// Polygon counts per period, by side count, derived from each period's lattice cells.
const COUNTS: Record<TilingId, Record<number, number>> = {
  square: { 4: 1 },
  hex: { 6: 2 },
  '488': { 8: 1, 4: 1 },
  '3636': { 6: 2, 3: 4 },
  '4612': { 12: 2, 6: 4, 4: 6 },
};

const next = (p: Pt[], i: number): Pt => p[(i + 1) % p.length]!;
const signedArea = (p: Pt[]) => p.reduce((s, [x, y], i) => s + (x * next(p, i)[1] - next(p, i)[0] * y), 0) / 2;

test('every edge has unit length', () => {
  for (const id of IDS)
    for (const p of tiling(id).polygons)
      p.forEach(([x, y], i) => {
        const [u, v] = next(p, i);
        assert.ok(Math.abs(Math.hypot(u - x, v - y) - 1) < 1e-9, id);
      });
});

test('polygons are counter-clockwise and cover the period exactly once', () => {
  for (const id of IDS) {
    const { width, height, polygons } = tiling(id);
    for (const p of polygons) assert.ok(signedArea(p) > 0, id);
    const total = polygons.reduce((s, p) => s + signedArea(p), 0);
    assert.ok(Math.abs(total - width * height) < 1e-6, `${id}: ${total} vs ${width * height}`);
  }
});

test('polygon counts per period match the vertex configuration', () => {
  for (const id of IDS) {
    const counts: Record<number, number> = {};
    for (const p of tiling(id).polygons) counts[p.length] = (counts[p.length] ?? 0) + 1;
    assert.deepEqual(counts, COUNTS[id], id);
    // Area of a unit regular n-gon is n / (4 tan(π/n)).
    const { width, height } = tiling(id);
    const area = Object.entries(counts).reduce((s, [n, c]) => s + (c * +n) / (4 * Math.tan(Math.PI / +n)), 0);
    assert.ok(Math.abs(area - width * height) < 1e-6, id);
  }
});

test('the angles at every vertex, modulo the period, sum to 2π', () => {
  for (const id of IDS) {
    const { width, height, polygons } = tiling(id);
    const key = (v: number, m: number) => {
      const r = Math.round((((v % m) + m) % m) * 1e6);
      return r === Math.round(m * 1e6) ? 0 : r;
    };
    const sums = new Map<string, number>();
    for (const p of polygons)
      for (const [x, y] of p) {
        const k = `${key(x, width)},${key(y, height)}`;
        sums.set(k, (sums.get(k) ?? 0) + ((p.length - 2) * Math.PI) / p.length);
      }
    for (const [k, s] of sums) assert.ok(Math.abs(s - 2 * Math.PI) < 1e-9, `${id} at ${k}: ${s}`);
  }
});

test('output is deterministic', () => {
  for (const id of IDS) assert.deepEqual(tiling(id), tiling(id));
});
