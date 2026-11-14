import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accentDefaults, accentEffective, accentShapes, decodeAccentLayer, encodeAccentLayer, type AccentLayer } from './accent-layer.ts';
import { isClosed } from './fills.ts';
import { accentGeometry } from './fractal.ts';
import type { Pt } from './patterns/util.ts';

const grid = (o: Partial<AccentLayer> = {}): AccentLayer => ({
  on: true,
  shape: 'dot',
  size: 15,
  amount: 100,
  place: 'grid',
  snap: 8,
  ...o,
});
const center = (p: readonly Pt[]): Pt => {
  const q = p.slice(0, -1);
  return [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length];
};
const inside = (polys: readonly (readonly Pt[])[], size: number) =>
  polys.every((p) => p.every(([x, y]) => x >= 0 && x <= size && y >= 0 && y <= size));
const signedArea = (p: readonly Pt[]) => p.slice(0, -1).reduce((s, [x0, y0], i) => s + x0 * p[i + 1]![1] - p[i + 1]![0] * y0, 0) / 2;

test('defaults: own shapes for kinds with the hook, off for the others', () => {
  assert.equal(accentDefaults('truchet').on, true);
  assert.equal(accentDefaults('truchet').shape, 'own');
  assert.equal(accentDefaults('truchet').size, 15);
  assert.equal(accentDefaults('tree').on, false);
  assert.deepEqual(accentShapes('tree', accentDefaults('tree'), { seed: 1, depth: 4, size: 96 }), []);
});

test('Truchet and Sprigs with the defaults draw exactly their accent geometry', () => {
  for (const seed of [1, 42, 123456])
    for (const kind of ['truchet', 'sprigs'] as const)
      assert.deepEqual(
        accentShapes(kind, accentDefaults(kind), { seed, depth: 4, size: 96 }),
        accentGeometry({ kind, seed, depth: 4, size: 96 }),
      );
});

test('own places with a larger size scale each shape about its center; another shape keeps the centers', () => {
  const own = accentGeometry({ kind: 'truchet', seed: 3, depth: 4, size: 96 });
  const big = accentShapes('truchet', { ...accentDefaults('truchet'), size: 30 }, { seed: 3, depth: 4, size: 96 });
  const sq = accentShapes('truchet', { ...accentDefaults('truchet'), shape: 'square' }, { seed: 3, depth: 4, size: 96 });
  assert.equal(big.length, own.length);
  // Radius 30 % of the 24 px cell; the dots on the first row and column (offset c / 5 < r) shift inside the tile.
  big.forEach((p) => {
    const c = center(p);
    assert.ok(Math.abs(Math.hypot(p[0]![0] - c[0], p[0]![1] - c[1]) - 0.3 * 24) < 1e-9);
  });
  assert.ok(inside(big, 96));
  center(big[5]!).forEach((v, k) => assert.ok(Math.abs(v - center(own[5]!)[k]!) < 1e-9)); // an inner corner keeps its place
  sq.forEach((p, i) => center(p).forEach((v, k) => assert.ok(Math.abs(v - center(own[i]!)[k]!) < 1e-9)));
});

test('grid snap 4: 16 dots on the cell centers, closed, inside the tile', () => {
  const polys = accentShapes('tree', grid({ snap: 4 }), { seed: 1, depth: 4, size: 120 });
  assert.equal(polys.length, 16);
  const want = [15, 45, 75, 105];
  polys.forEach((p, i) => {
    const [x, y] = center(p);
    assert.ok(Math.abs(x - want[i % 4]!) < 1e-9 && Math.abs(y - want[Math.floor(i / 4)]!) < 1e-9);
    assert.ok(isClosed(p));
  });
  assert.ok(inside(polys, 120));
});

test('amount 50 keeps half the grid places, chosen by the seed', () => {
  const key = (seed: number) =>
    accentShapes('tree', grid({ amount: 50 }), { seed, depth: 4, size: 120 })
      .map((p) => center(p).join(','))
      .join(';');
  assert.equal(accentShapes('tree', grid({ amount: 50 }), { seed: 7, depth: 4, size: 120 }).length, 32);
  assert.equal(key(7), key(7));
  assert.notEqual(key(7), key(8));
});

test('seed placement: 64 shapes at amount 100, all whole inside the tile, for every shape', () => {
  for (const shape of ['dot', 'ring', 'square', 'triangle', 'diamond', 'drop', 'leaf'] as const)
    for (const size of [15, 40]) {
      const polys = accentShapes('tree', grid({ place: 'seed', shape, size }), { seed: 5, depth: 4, size: 120 });
      assert.equal(polys.length, 64);
      assert.ok(inside(polys, 120), `${shape} ${size}`);
      assert.ok(polys.every(isClosed));
    }
  assert.equal(accentShapes('tree', grid({ place: 'seed', amount: 50 }), { seed: 5, depth: 4, size: 120 }).length, 32);
});

test('a ring has an inner loop the other way round', () => {
  const [ring] = accentShapes('tree', grid({ shape: 'ring', snap: 4 }), { seed: 1, depth: 4, size: 120 });
  assert.ok(ring && isClosed(ring));
  assert.equal(ring.length, 35); // 17 outer, 17 inner, back to the start
  assert.ok(Math.sign(signedArea(ring.slice(0, 17))) === -Math.sign(signedArea(ring.slice(17, 34))));
});

test('codec: round trip, defaults give no al, clamping, garbage gives the defaults', () => {
  const layers: [Parameters<typeof encodeAccentLayer>[0], AccentLayer][] = [
    ['tree', grid()],
    ['tree', grid({ shape: 'leaf', size: 40, amount: 10, place: 'seed', snap: 16 })],
    ['truchet', { ...accentDefaults('truchet'), on: false }],
    ['truchet', grid({ shape: 'own', place: 'own', size: 22 })],
    ['sprigs', grid({ shape: 'diamond', amount: 75, snap: 12 })],
  ];
  for (const [kind, l] of layers) assert.deepEqual(decodeAccentLayer(kind, encodeAccentLayer(kind, l)), l);
  for (const kind of ['tree', 'truchet', 'sprigs'] as const) {
    assert.equal(encodeAccentLayer(kind, accentDefaults(kind)), null);
    assert.deepEqual(decodeAccentLayer(kind, null), accentDefaults(kind));
  }
  assert.deepEqual(decodeAccentLayer('tree', '1_d_15_100_g_8'), grid());
  for (const bad of ['', 'x', '1_d_15_100_g', '2_d_15_100_g_8', '1_z_15_100_g_8', '1_d_a_100_g_8', '1_o_15_100_o_8'])
    assert.deepEqual(decodeAccentLayer('tree', bad), accentDefaults('tree'), bad);
  assert.equal(decodeAccentLayer('tree', '1_d_99_100_g_8').size, 40);
  assert.equal(decodeAccentLayer('tree', '1_d_1_5_g_99').amount, 10);
  assert.equal(decodeAccentLayer('tree', '1_d_1_5_g_99').snap, 16);
});

test('accentEffective: own becomes a dot on a grid where the kind is not drawn, other layers pass through', () => {
  const own = accentDefaults('truchet');
  assert.equal(accentEffective(own, true), own);
  assert.deepEqual(accentEffective(own, false), { ...own, shape: 'dot', place: 'grid' });
  const ring = { ...own, shape: 'ring', place: 'own' } as const;
  assert.deepEqual(accentEffective(ring, false), { ...ring, place: 'grid' });
  const seed = { ...own, shape: 'triangle', place: 'seed' } as const;
  assert.equal(accentEffective(seed, false), seed);
  assert.equal(accentDefaults('truchet', true).on, false);
});
