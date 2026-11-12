import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceCurves } from './smoothtrace.ts';
import type { Gray } from './trace.ts';

// A white disc of radius 30 on black, 96 x 96.
const disc: Gray = {
  width: 96,
  height: 96,
  data: Float32Array.from({ length: 96 * 96 }, (_, i) => (Math.hypot((i % 96) + 0.5 - 48, Math.floor(i / 96) + 0.5 - 48) <= 30 ? 255 : 0)),
};
const opts = { detector: 'canny', threshold: 0.3, size: 120, minLength: 8, smooth: 1.5, tolerance: 0.8, refineSteps: 40 } as const;

const samples = (chains: readonly (readonly (readonly (readonly [number, number])[])[])[]) =>
  chains.flat().flatMap((c) =>
    Array.from({ length: 17 }, (_, i) => {
      const u = i / 16;
      const s = 1 - u;
      const b = [s * s * s, 3 * s * s * u, 3 * s * u * u, u * u * u];
      return [b.reduce((a, w, j) => a + w * c[j]![0], 0), b.reduce((a, w, j) => a + w * c[j]![1], 0)] as const;
    }),
  );

test('traceCurves: a disc becomes a few smooth cubics on the scaled circle', () => {
  const t = traceCurves(disc, opts);
  console.log(`disc: ${t.chains.length} chain(s), ${t.chains.map((c) => c.length).join('+')} cubics`);
  assert.ok(t.chains.flat().length <= 12, `${t.chains.flat().length} cubics`);
  // Scaled exactly as vectorize: s = 120 / 96, centered; the image circle (48, 48) r 30 becomes (60, 60) r 37.5.
  for (const [x, y] of samples(t.chains)) assert.ok(Math.abs(Math.hypot(x - 60, y - 60) - 37.5) <= 1.5, `${x} ${y}`);
  const d = t.d(1);
  assert.ok(!d.includes('L') && !d.includes('l'), d);
  assert.equal(traceCurves(disc, opts).d(1), d);
});

test('traceCurves: coordinates stay inside the tile', () => {
  const edge: Gray = {
    width: 64,
    height: 48,
    data: Float32Array.from({ length: 64 * 48 }, (_, i) => ((i % 64) + Math.floor(i / 64) < 50 ? 255 : 0)),
  };
  for (const refineSteps of [0, 40]) {
    const t = traceCurves(edge, { ...opts, size: 100, refineSteps });
    assert.ok(t.chains.length > 0);
    for (const c of t.chains.flat()) for (const [x, y] of c) assert.ok(x >= -1 && x <= 101 && y >= -1 && y <= 101, `${x} ${y}`);
  }
});
