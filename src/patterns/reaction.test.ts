import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { svgFromPolylines } from '../fractal.ts';
import { reactionField, reactionShapes, type ReactionKind } from './reaction.ts';
import { mulberry32, type Pt } from './util.ts';

const KINDS: ReactionKind[] = ['stripes', 'spots'];
const S = 120;
const shapes = (kind: ReactionKind, seed: number, depth = 3) => reactionShapes(kind, mulberry32(seed), depth, S);

test('seamless: every end on an edge has a partner on the opposite edge', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 3; seed++) {
      const polys = shapes(kind, seed);
      assert.ok(polys.length > 0);
      const ends: Pt[] = [];
      for (const p of polys) {
        const a = p[0]!;
        const b = p[p.length - 1]!;
        if (a[0] === b[0] && a[1] === b[1]) continue; // closed loop
        ends.push(a, b);
      }
      const near = (x: number, y: number) => ends.some(([ex, ey]) => Math.abs(ex - x) <= 0.5 && Math.abs(ey - y) <= 0.5);
      let onEdge = 0;
      for (const [x, y] of ends) {
        let ok = false;
        if (x <= 1e-9) ok ||= near(S, y);
        if (x >= S - 1e-9) ok ||= near(0, y);
        if (y <= 1e-9) ok ||= near(x, S);
        if (y >= S - 1e-9) ok ||= near(x, 0);
        const edge = x <= 1e-9 || x >= S - 1e-9 || y <= 1e-9 || y >= S - 1e-9;
        assert.ok(edge, `${kind} seed ${seed}: open end inside the tile at ${x},${y}`);
        assert.ok(ok, `${kind} seed ${seed}: no partner for ${x},${y}`);
        onEdge++;
      }
      console.log(`seamless ${kind} seed ${seed}: ${polys.length} polylines, ${onEdge} edge ends`);
    }
  }
});

// Connected components of V > level on the torus (4-neighbours).
function components(n: number, V: Float32Array, level: number): number[] {
  const label = new Int32Array(n * n).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < n * n; i++) {
    if (V[i]! <= level || label[i]! >= 0) continue;
    const id = sizes.length;
    let count = 0;
    const stack = [i];
    label[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      count++;
      const x = j % n;
      const y = (j - x) / n;
      for (const q of [y * n + ((x + 1) % n), y * n + ((x + n - 1) % n), ((y + 1) % n) * n + x, ((y + n - 1) % n) * n + x]) {
        if (V[q]! > level && label[q]! < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(count);
  }
  return sizes;
}

test('regimes: stripes are few long components, spots many small ones', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const r: Record<string, number[]> = {};
    for (const kind of KINDS) {
      const { n, V, level } = reactionField(kind, mulberry32(seed), 3);
      r[kind] = components(n, V, level);
      const c = r[kind];
      const mean = c.reduce((a, b) => a + b, 0) / c.length;
      console.log(
        `regime ${kind} seed ${seed}: ${c.length} components, mean ${mean.toFixed(0)} cells, max ${Math.max(...c)}, level ${level.toFixed(3)}`,
      );
    }
    const spots = r.spots!;
    assert.ok(spots.length >= 10, `spots seed ${seed}: ${spots.length}`);
    // Small: under a tenth of the grid (a stripe network measured 969 to 1843 cells of 4096).
    assert.ok(Math.max(...spots) < 0.1 * 64 * 64, `spots seed ${seed}: a large component`);
    assert.ok(r.stripes!.length < spots.length, `seed ${seed}`);
  }
});

test('determinism', () => {
  for (const kind of KINDS) {
    assert.deepEqual(shapes(kind, 5, 1), shapes(kind, 5, 1));
    assert.notDeepEqual(shapes(kind, 5, 1), shapes(kind, 6, 1));
  }
});

test('size: under the square cap, gzip reported', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 3; seed++) {
      const svg = svgFromPolylines(shapes(kind, seed), { size: S, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 });
      const gz = gzipSync(svg, { level: 9 }).length;
      console.log(`size ${kind} seed ${seed}: ${svg.length} chars, ${gz} B gzip`);
      assert.ok(svg.length <= 60000, `${kind} seed ${seed}: ${svg.length}`);
    }
  }
});

test('timing at depth 3', () => {
  for (const kind of KINDS) {
    const t0 = performance.now();
    shapes(kind, 1);
    const ms = performance.now() - t0;
    console.log(`timing ${kind}: ${ms.toFixed(0)} ms`);
    assert.ok(ms < 1500, `${kind}: ${ms}`);
  }
});
