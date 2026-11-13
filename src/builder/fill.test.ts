import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gridFill } from './fill.ts';
import type { FillOptions } from './fill.ts';

const base: FillOptions = {
  width: 240,
  height: 120,
  columns: 4,
  rows: 2,
  stamps: [
    { index: 0, box: 100, parts: 1 },
    { index: 1, box: 24, parts: 2 },
    { index: 2, box: 100, parts: 1 },
  ],
  seed: 1,
  size: 0.5,
  sizeJitter: 0,
  jitter: 0,
  rotate: 'none',
  stagger: false,
  flip: false,
  colors: [],
  firstId: 1,
};

const counts = (items: { stamp: number }[]): number[] => {
  const m = [0, 0, 0];
  for (const it of items) m[it.stamp] = (m[it.stamp] ?? 0) + 1;
  return m.sort((a, b) => b - a);
};

test('8 items with ids 1..8 on the grid centers', () => {
  const items = gridFill(base);
  assert.deepEqual(
    items.map((it) => it.id),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  items.forEach((it, k) => {
    assert.equal(it.x, ((k % 4) + 0.5) * 60);
    assert.equal(it.y, (Math.floor(k / 4) + 0.5) * 60);
    assert.equal(it.opacity, 1);
  });
});

test('scale follows the box', () => {
  for (const it of gridFill(base)) {
    const want = it.stamp === 1 ? 1.25 : 0.3;
    assert.ok(Math.abs(it.scale - want) < 1e-9, `${it.scale}`);
  }
});

test('stagger shifts odd rows and wraps', () => {
  const items = gridFill({ ...base, stagger: true });
  assert.deepEqual(
    items.slice(4).map((it) => it.x),
    [60, 120, 180, 0],
  );
});

test('the bag balances the stamps and avoids equal neighbors', () => {
  assert.deepEqual(counts(gridFill(base)), [3, 3, 2]);
  for (let seed = 1; seed <= 20; seed++) {
    const items = gridFill({ ...base, columns: 6, rows: 6, seed });
    assert.deepEqual(counts(items), [12, 12, 12]);
    items.forEach((it, k) => {
      if (k % 6 > 0) assert.notEqual(it.stamp, items[k - 1]?.stamp, `seed ${seed} item ${k}`);
    });
  }
});

test('deterministic per seed', () => {
  assert.deepEqual(gridFill(base), gridFill(base));
  const o = { ...base, jitter: 0.5, rotate: 'free' as const };
  assert.notDeepEqual(gridFill({ ...o, seed: 1 }), gridFill({ ...o, seed: 2 }));
});

test('jitter 1 stays within half a cell, wrapped into the tile', () => {
  const torus = (a: number, b: number, m: number): number => {
    const d = Math.abs(a - b) % m;
    return Math.min(d, m - d);
  };
  for (let seed = 1; seed <= 20; seed++) {
    gridFill({ ...base, jitter: 1, seed }).forEach((it, k) => {
      assert.ok(torus(it.x, ((k % 4) + 0.5) * 60, 240) <= 30 + 1e-9);
      assert.ok(torus(it.y, (Math.floor(k / 4) + 0.5) * 60, 120) <= 30 + 1e-9);
      assert.ok(it.x >= 0 && it.x < 240 && it.y >= 0 && it.y < 120);
    });
  }
});

test('rotate modes', () => {
  const seen = new Set<number>();
  for (let seed = 1; seed <= 5; seed++) {
    for (const it of gridFill({ ...base, columns: 6, rows: 6, seed, rotate: 'quarter' })) {
      assert.ok([0, 90, 180, 270].includes(it.rotate));
      seen.add(it.rotate);
    }
  }
  assert.ok(seen.size >= 3);
  for (const it of gridFill({ ...base, rotate: 'free' })) assert.ok(it.rotate >= 0 && it.rotate < 360);
  for (const it of gridFill(base)) assert.equal(it.rotate, 0);
});

test('options are independent', () => {
  const o = { ...base, jitter: 0.7, sizeJitter: 0.5, rotate: 'quarter' as const };
  const pick = (it: { x: number; y: number; scale: number; rotate: number; stamp: number }) => [it.x, it.y, it.scale, it.rotate, it.stamp];
  assert.deepEqual(gridFill(o).map(pick), gridFill({ ...o, flip: true }).map(pick));
  const a = { ...o, rotate: 'none' as const };
  const pick2 = (it: { x: number; y: number; scale: number; flip: boolean; stamp: number }) => [it.x, it.y, it.scale, it.flip, it.stamp];
  assert.deepEqual(gridFill(a).map(pick2), gridFill({ ...a, rotate: 'free' }).map(pick2));
  assert.deepEqual(gridFill({ ...a, flip: true }).map(pick2), gridFill({ ...a, flip: true, rotate: 'free' }).map(pick2));
});

test('sizeJitter 1 keeps a box 100 scale in [0.15, 0.45]', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const it of gridFill({ ...base, sizeJitter: 1, seed })) {
      if (it.stamp !== 1) assert.ok(it.scale >= 0.15 && it.scale <= 0.45, `${it.scale}`);
    }
  }
});

test('colors', () => {
  const items = gridFill({ ...base, colors: ['#aa0000', '#00aa00'] });
  const used = new Set<string>();
  for (const it of items) {
    assert.equal(it.colors.length, it.stamp === 1 ? 2 : 1);
    assert.ok(it.colors.every((c) => c === it.colors[0]));
    used.add(it.colors[0] ?? '');
  }
  assert.deepEqual([...used].sort(), ['#00aa00', '#aa0000']);
  for (const it of gridFill(base)) assert.deepEqual(it.colors, []);
});

test('columns are clamped, empty stamps give nothing', () => {
  assert.equal(gridFill({ ...base, columns: 0, rows: 1 }).length, 1);
  assert.equal(gridFill({ ...base, columns: 99, rows: 1 }).length, 40);
  assert.deepEqual(gridFill({ ...base, stamps: [] }), []);
});

test('source hygiene', () => {
  const src = readFileSync(new URL('./fill.ts', import.meta.url), 'utf8');
  for (const bad of ['Math.random', 'Date', 'document', 'window']) assert.ok(!src.includes(bad), bad);
});
