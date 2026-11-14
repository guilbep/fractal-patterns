import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type SurfaceKind, surfacePixels, surfaceRange } from './surfaces.ts';

const KINDS: SurfaceKind[] = ['paper', 'coldpress', 'linen', 'plaster', 'sand', 'riso'];
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

const base = { seed: 1, scale: 1, strength: 100, tone: 'dark' as const, background: '#8090a0' };
const lumAt = (p: Uint8ClampedArray, i: number) => 0.2126 * p[i]! + 0.7152 * p[i + 1]! + 0.0722 * p[i + 2]!;
const meanLum = (p: Uint8ClampedArray) => {
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s += lumAt(p, i);
  return s / (p.length / 4);
};

for (const kind of KINDS) {
  test(`${kind}: wraps for seeds 1..3`, () => {
    for (const seed of [1, 2, 3]) {
      const p = surfacePixels(kind, { ...base, seed });
      const d = edgeDiffs((x, y) => lumAt(p, (y * N + x) * 4), N);
      assert.ok(d.colEdge <= 1.5 * d.colInner, `seed ${seed} cols ${JSON.stringify(d)}`);
      assert.ok(d.rowEdge <= 1.5 * d.rowInner, `seed ${seed} rows ${JSON.stringify(d)}`);
    }
  });

  test(`${kind}: deterministic, seed-dependent`, () => {
    const a = surfacePixels(kind, base);
    assert.deepEqual(a, surfacePixels(kind, base));
    assert.notDeepEqual(a, surfacePixels(kind, { ...base, seed: 2 }));
  });

  test(`${kind}: strength 0 is the flat background, alpha 255`, () => {
    const p = surfacePixels(kind, { ...base, strength: 0 });
    assert.equal(p.length, N * N * 4);
    for (let i = 0; i < p.length; i += 4) {
      if (p[i] !== 0x80 || p[i + 1] !== 0x90 || p[i + 2] !== 0xa0 || p[i + 3] !== 255) assert.fail(`pixel ${i / 4}`);
    }
    assert.ok(surfacePixels(kind, base).every((v, i) => i % 4 !== 3 || v === 255));
  });

  test(`${kind}: dark darkens, light lightens`, () => {
    const bgLum = lumAt(new Uint8ClampedArray([0x80, 0x90, 0xa0, 255]), 0);
    assert.ok(meanLum(surfacePixels(kind, base)) <= bgLum);
    assert.ok(meanLum(surfacePixels(kind, { ...base, tone: 'light' })) >= bgLum);
    const r = surfaceRange(surfacePixels(kind, base));
    assert.ok(lumAt(new Uint8ClampedArray([...r.darkest, 255]), 0) < bgLum);
  });

  test(`${kind}: under 400 ms per 256 tile`, () => {
    const t = performance.now();
    surfacePixels(kind, { ...base, scale: 2 });
    const ms = performance.now() - t;
    console.log(`${kind}: ${ms.toFixed(1)} ms`);
    assert.ok(ms < 400);
  });
}
