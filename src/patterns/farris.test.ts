import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FARRIS_GROUPS, farrisAt, farrisGrid, isHexGroup, type FarrisRecipe } from './farris.ts';
import { GROUP_OPS, HEX_OPS, apply } from './symmetry.ts';
import { mulberry32 } from './util.ts';

const S3 = Math.sqrt(3);
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const recipe = (group: string, seed: number): FarrisRecipe => ({ group, seed, waves: 6, detail: 4 });

test('farris: 17 groups', () => {
  assert.equal(FARRIS_GROUPS.length, 17);
  assert.equal(new Set(FARRIS_GROUPS).size, 17);
});

test('farris: invariant under every op of its group', () => {
  for (const group of FARRIS_GROUPS)
    for (let seed = 1; seed <= 5; seed++) {
      const r = recipe(group, seed);
      const rnd = mulberry32(1000 + seed);
      let worst = 0;
      for (let s = 0; s < 200; s++) {
        const u = rnd();
        const v = rnd();
        const f = farrisAt(r, u, v);
        if (isHexGroup(group))
          for (const m of HEX_OPS[group]!) {
            const [x, y] = apply(m, [u, v * S3]);
            worst = Math.max(worst, dist(farrisAt(r, x, y / S3), f));
          }
        else
          for (const op of GROUP_OPS[group]!) {
            const [x, y] = op([u, v]);
            worst = Math.max(worst, dist(farrisAt(r, x, y), f));
          }
      }
      assert.ok(worst < 1e-9, `${group} seed ${seed}: ${worst}`);
    }
});

test('farris: the tile is a period', () => {
  for (const group of FARRIS_GROUPS) {
    const r = recipe(group, 3);
    const rnd = mulberry32(7);
    for (let s = 0; s < 50; s++) {
      const u = rnd();
      const v = rnd();
      const f = farrisAt(r, u, v);
      assert.ok(dist(farrisAt(r, u + 1, v), f) < 1e-9, group);
      assert.ok(dist(farrisAt(r, u, v + 1), f) < 1e-9, group);
    }
  }
});

test('farris: p1 has no half turn', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const r = recipe('p1', seed);
    const rnd = mulberry32(seed);
    let most = 0;
    for (let s = 0; s < 100; s++) {
      const u = rnd();
      const v = rnd();
      most = Math.max(most, dist(farrisAt(r, 1 - u, 1 - v), farrisAt(r, u, v)));
    }
    assert.ok(most > 1e-3, `seed ${seed}: ${most}`);
  }
});

test('farris: grid is never flat', () => {
  for (const group of FARRIS_GROUPS)
    for (let seed = 1; seed <= 50; seed++) {
      const { re } = farrisGrid(recipe(group, seed), 32);
      const mean = re.reduce((a, b) => a + b, 0) / re.length;
      const sd = Math.sqrt(re.reduce((a, b) => a + (b - mean) ** 2, 0) / re.length);
      assert.ok(sd > 1e-3, `${group} seed ${seed}: ${sd}`);
    }
});

test('farris: deterministic, and seeds differ', () => {
  const a = farrisGrid(recipe('p4g', 9), 16);
  const b = farrisGrid(recipe('p4g', 9), 16);
  const c = farrisGrid(recipe('p4g', 10), 16);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('farris: p6m grid at n 96 under 500 ms', () => {
  const r: FarrisRecipe = { group: 'p6m', seed: 1, waves: 8, detail: 6 };
  farrisGrid(r, 96); // warm up
  const t0 = performance.now();
  farrisGrid(r, 96);
  const ms = performance.now() - t0;
  console.log(`farris p6m n 96: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 500, `${ms} ms`);
});
