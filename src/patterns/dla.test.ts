import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { svgFromPolylines } from '../fractal.ts';
import { dlaShapes, growDla } from './dla.ts';
import { mulberry32 } from './util.ts';

const KINDS = ['coral', 'frost'] as const;
const S = 120;

test('growth: each particle touches its parent, none overlap', () => {
  const r = 2;
  const L = 200;
  const g = growDla({ particles: 300, seeds: 3, radius: r, rnd: mulberry32(5), side: L });
  const wd = (v: number) => v - L * Math.round(v / L);
  const dist = (i: number, j: number) => Math.hypot(wd(g.x[i]! - g.x[j]!), wd(g.y[i]! - g.y[j]!));
  let seeds = 0;
  for (let i = 0; i < 300; i++) {
    const p = g.parent[i]!;
    if (p < 0) seeds++;
    // Float32 storage rounds coordinates near 200 to ~1e-5, so the contact is checked at that precision.
    else assert.ok(Math.abs(dist(i, p) - 2 * r) < 1e-4, `${i}: ${dist(i, p)}`);
    for (let j = 0; j < i; j++) assert.ok(dist(i, j) >= 2 * r - 1e-4, `${i}-${j}: ${dist(i, j)}`);
  }
  assert.equal(seeds, 3);
});

test('seamless: every polyline end on an edge meets one on the opposite edge', () => {
  // A small cluster may sit clear of every edge, so crossings are counted over all cases.
  let onEdge = 0;
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 3; seed++) {
      const polys = dlaShapes(kind, mulberry32(seed), 2, S);
      const ends = polys.flatMap((p) => [p[0]!, p[p.length - 1]!]);
      for (const [x, y] of ends) {
        for (const [v, w, ax] of [
          [x, y, 0],
          [y, x, 1],
        ] as const) {
          if (v > 1e-6 && v < S - 1e-6) continue;
          onEdge++;
          const o = v < S / 2 ? S : 0;
          const hit = ends.some((e) => Math.abs(e[ax] - o) < 1e-6 && Math.abs(e[1 - ax]! - w) < 0.5);
          assert.ok(hit, `${kind} seed ${seed}: end (${x}, ${y}) has no partner`);
        }
      }
    }
  }
  assert.ok(onEdge > 0, 'nothing crosses an edge');
});

test('determinism; another seed differs', () => {
  for (const kind of KINDS) {
    assert.deepEqual(dlaShapes(kind, mulberry32(7), 1, S), dlaShapes(kind, mulberry32(7), 1, S));
    assert.notDeepEqual(dlaShapes(kind, mulberry32(7), 1, S), dlaShapes(kind, mulberry32(8), 1, S));
  }
});

test('size and time per depth at size 120 (board: 900 particles ~2.9 KB, 2000 ~6.6 KB gzip)', () => {
  const p = { size: S, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 };
  for (const kind of KINDS) {
    for (let depth = 1; depth <= 4; depth++) {
      const t0 = performance.now();
      const polys = dlaShapes(kind, mulberry32(1), depth, S);
      const ms = performance.now() - t0;
      const svg = svgFromPolylines(polys, p);
      const gz = gzipSync(svg, { level: 9 }).length;
      console.log(`${kind} depth ${depth}: ${polys.length} polylines, ${svg.length} chars, ${gz} B gzip, ${ms.toFixed(0)} ms`);
      assert.ok(svg.length <= 60000, `${kind} depth ${depth}: ${svg.length}`);
      if (depth === 4) assert.ok(ms < 1500, `${kind} depth 4: ${ms} ms`);
    }
  }
});
