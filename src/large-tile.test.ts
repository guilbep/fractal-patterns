import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MAX_DEPTH, generate, geometry, type Kind } from './fractal.ts';
import { largeTileBytes, largeTileKinds } from './large-tile.ts';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test('largeTileKinds lists the field kinds', () => {
  assert.deepEqual(largeTileKinds(), ['topo', 'maze', 'cracks']);
});

// Hashes of every depth for seeds 1, 7 and 42, taken before the period existed: period 1 must not move a byte.
const PERIOD_1: Readonly<Record<string, string>> = { topo: '776d558bec2a7203', maze: 'b547b27d8c196a09', cracks: '3e2da29cce6dc403' };

test('period 1 draws exactly what the kind drew before', () => {
  for (const kind of largeTileKinds()) {
    for (const period of [{}, { period: 1 }]) {
      const h = createHash('sha256');
      for (const seed of [1, 7, 42])
        for (let depth = 1; depth <= MAX_DEPTH[kind]; depth++)
          h.update(generate({ kind, seed, depth, size: 120, ...period, strokeWidth: 2, precision: 2, color: '#000', opacity: 1 }));
      assert.equal(h.digest('hex').slice(0, 16), PERIOD_1[kind], `${kind} ${JSON.stringify(period)}`);
    }
  }
});

test('a kind without a large tile ignores the period', () => {
  const p = { kind: 'tree' as Kind, seed: 3, depth: 6, size: 120 };
  assert.deepEqual(geometry({ ...p, period: 4 }), geometry(p));
});

test('large tiles are seamless', () => {
  for (const kind of largeTileKinds()) {
    for (const seed of [1, 2, 3]) {
      const S = 240;
      const msg = `${kind} seed ${seed}`;
      const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
      for (const poly of geometry({ kind, seed, depth: 2, size: 120, period: 2 })) {
        for (const [x, y] of poly) {
          assert.ok(x > -1e-6 && x < S + 1e-6 && y > -1e-6 && y < S + 1e-6, `${msg}: point outside`);
          if (near(x, 0)) cross.x0.push(y);
          if (near(x, S)) cross.xS.push(y);
          if (near(y, 0)) cross.y0.push(x);
          if (near(y, S)) cross.yS.push(x);
        }
      }
      for (const [a, b, side] of [
        [cross.x0, cross.xS, 'x'],
        [cross.y0, cross.yS, 'y'],
      ] as const) {
        a.sort((p, q) => p - q);
        b.sort((p, q) => p - q);
        assert.equal(a.length, b.length, `${msg}: ${side} count`);
        assert.ok(a.length > 0, `${msg}: ${side} has crossings`);
        a.forEach((v, i) => assert.ok(near(v, b[i]!), `${msg}: ${side} ${v} vs ${b[i]}`));
      }
    }
  }
});

const length = (polys: readonly (readonly (readonly [number, number])[])[]) =>
  polys.reduce((s, p) => s + p.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - p[i]![0], q[1] - p[i]![1]), 0), 0);
const density = (kind: Kind, period: number) => {
  let sum = 0;
  for (let seed = 1; seed <= 10; seed++) sum += length(geometry({ kind, seed, depth: 1, size: 120, period })) / (120 * period) ** 2;
  return sum / 10;
};

test('topography at period 2 keeps the contour spacing', () => {
  const ratio = density('topo', 2) / density('topo', 1);
  assert.ok(Math.abs(ratio - 1) < 0.15, `ratio ${ratio}`);
  assert.equal(ratio.toFixed(3), '1.033'); // measured, seeds 1-10, depth 1, size 120
});

test('largeTileBytes is the generate length and grows with the period', () => {
  const b = [1, 2, 4].map((p) => largeTileBytes('topo', 1, 1, 120, p));
  assert.ok(b[0]! < b[1]! && b[1]! < b[2]!, String(b));
  assert.equal(
    b[0],
    generate({ kind: 'topo', seed: 1, depth: 1, size: 120, strokeWidth: 2, precision: 1, color: '#000000', opacity: 0.6 }).length,
  );
});
