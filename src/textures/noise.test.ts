import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emboss, periodicNoise } from './noise.ts';

const N = 256;

// Mean |a - b| over the column pair (x0, x1) and over the row pair (y0, y1).
function edgeDiffs(get: (x: number, y: number) => number, n: number) {
  const col = (x0: number, x1: number) => {
    let s = 0;
    for (let y = 0; y < n; y++) s += Math.abs(get(x0, y) - get(x1, y));
    return s / n;
  };
  const row = (y0: number, y1: number) => {
    let s = 0;
    for (let x = 0; x < n; x++) s += Math.abs(get(x, y0) - get(x, y1));
    return s / n;
  };
  let ci = 0;
  let ri = 0;
  for (let i = 0; i < n - 1; i++) {
    ci += col(i, i + 1);
    ri += row(i, i + 1);
  }
  return { colEdge: col(0, n - 1), colInner: ci / (n - 1), rowEdge: row(0, n - 1), rowInner: ri / (n - 1) };
}

test('periodic noise wraps: edge pair is no rougher than interior neighbours', () => {
  for (const seed of [1, 2, 3]) {
    const h = periodicNoise(N, seed, { scale: 8, octaves: 4 });
    const d = edgeDiffs((x, y) => h[y * N + x]!, N);
    assert.ok(d.colEdge <= 1.5 * d.colInner, `seed ${seed} cols ${JSON.stringify(d)}`);
    assert.ok(d.rowEdge <= 1.5 * d.rowInner, `seed ${seed} rows ${JSON.stringify(d)}`);
  }
});

test('periodic noise is deterministic, seed-dependent and roughly in -1..1', () => {
  const a = periodicNoise(N, 1, { scale: 8, octaves: 4 });
  assert.deepEqual(a, periodicNoise(N, 1, { scale: 8, octaves: 4 }));
  assert.notDeepEqual(a, periodicNoise(N, 2, { scale: 8, octaves: 4 }));
  assert.ok(a.every((v) => v >= -1.5 && v <= 1.5));
});

test('emboss: flat height gives the Lambert value of the light, wraps', () => {
  const flat = emboss(new Float32Array(16 * 16), 16);
  assert.ok(flat.every((v) => Math.abs(v - 1 / Math.sqrt(3)) < 1e-6));
  const h = periodicNoise(N, 3, { scale: 8, octaves: 2 });
  const e = emboss(
    h.map((v) => v * 8),
    N,
  );
  const d = edgeDiffs((x, y) => e[y * N + x]!, N);
  assert.ok(d.colEdge <= 1.5 * d.colInner && d.rowEdge <= 1.5 * d.rowInner, JSON.stringify(d));
});

test('timing: 256^2 with 4 octaves', () => {
  const t = performance.now();
  periodicNoise(N, 1, { scale: 8, octaves: 4 });
  const ms = performance.now() - t;
  console.log(`periodicNoise 256^2 x4 octaves: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 400);
});
