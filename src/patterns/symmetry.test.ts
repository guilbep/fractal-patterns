import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry } from '../fractal.ts';
import { GROUP_OPS, GROUP_REGION, type Op } from './symmetry.ts';
import { mulberry32, type Pt } from './util.ts';

const eps = 1e-9;
const samples = (): Pt[] => {
  const rnd = mulberry32(7);
  return Array.from({ length: 50 }, (): Pt => [rnd(), rnd()]);
};
const near = (a: Pt, b: Pt, msg: string): void =>
  assert.ok(Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps, `${msg}: ${a} vs ${b}`);
const op = (group: string, i: number): Op => {
  const f = GROUP_OPS[group]?.[i];
  assert.ok(f, `${group} op ${i}`);
  return f;
};

test('identity first, every op maps the unit cell into itself', () => {
  for (const [group, ops] of Object.entries(GROUP_OPS)) {
    for (const p of samples()) {
      near(op(group, 0)(p), p, `${group} identity`);
      for (const f of ops) {
        const [x, y] = f(p);
        assert.ok(x >= -eps && x <= 1 + eps && y >= -eps && y <= 1 + eps, `${group}: ${p} -> ${x}, ${y}`);
      }
    }
  }
});

test('half turn and mirror are involutions, glide twice is a cell translation', () => {
  for (const p of samples()) {
    near(op('p2', 1)(op('p2', 1)(p)), p, 'p2');
    near(op('pm', 1)(op('pm', 1)(p)), p, 'pm');
    // Twice the glide is (x + 1, y), the identity modulo 1; x = 1 - eps and x = 0 are the same point.
    const [x, y] = op('pg', 1)(op('pg', 1)(p));
    const dx = Math.abs(x - p[0]);
    assert.ok(Math.min(dx, 1 - dx) < eps && Math.abs(y - p[1]) < eps, `pg: ${p} -> ${x}, ${y}`);
  }
});

test('motif fills the tile at depth 1', () => {
  for (const kind of ['p1', 'p2', 'pm', 'pg', 'cm', 'pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p4m', 'p4g'] as const) {
    for (let seed = 1; seed <= 20; seed++) {
      const pts = geometry({ kind, seed, depth: 1, size: 120 }).flat();
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const msg = `${kind} seed ${seed}`;
      assert.ok(Math.max(...xs) - Math.min(...xs) >= 72, msg);
      assert.ok(Math.max(...ys) - Math.min(...ys) >= 72, msg);
    }
  }
});

test('op counts', () => {
  for (const [group, count] of [
    ['p1', 1],
    ['p2', 2],
    ['pm', 2],
    ['pg', 2],
    ['cm', 4],
    ['pmm', 4],
    ['pmg', 4],
    ['pgg', 4],
    ['cmm', 8],
    ['p4', 4],
    ['p4m', 8],
    ['p4g', 8],
  ] as const)
    assert.equal(GROUP_OPS[group]?.length, count, group);
});

// Equal modulo 1: each coordinate difference is 0 or 1 (x = 1 - eps and x = 0 are the same point).
const sameMod1 = (a: Pt, b: Pt): boolean =>
  [0, 1].every((k) => {
    const d = Math.abs((a[k] ?? NaN) - (b[k] ?? NaN));
    return Math.min(d, Math.abs(1 - d)) < eps;
  });

test('every op list is a group modulo the lattice', () => {
  for (const [group, ops] of Object.entries(GROUP_OPS)) {
    for (const p of samples().slice(0, 20)) {
      for (const [i, f] of ops.entries()) {
        for (const [j, g] of ops.entries()) {
          const q = f(g(p));
          assert.ok(
            ops.some((h) => sameMod1(h(p), q)),
            `${group}: op ${i} after op ${j} at ${p}`,
          );
        }
      }
    }
  }
});

// The images of each region cover the whole cell, so no part of the tile is empty by construction.
test('images of the region cover the cell', () => {
  assert.deepEqual(Object.keys(GROUP_OPS).sort(), Object.keys(GROUP_REGION).sort());
  assert.equal(Object.keys(GROUP_OPS).length, 12); // also the groups the closure test runs over
  for (const [group, ops] of Object.entries(GROUP_OPS)) {
    const box = GROUP_REGION[group];
    assert.ok(box, group);
    const [x0, y0, x1, y1] = box;
    const m = (v: number): number => v - Math.floor(v);
    const inside = ([x, y]: Pt): boolean => m(x) >= x0 - eps && m(x) <= x1 + eps && m(y) >= y0 - eps && m(y) <= y1 + eps;
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        const p: Pt = [(i + 0.5) / 20, (j + 0.5) / 20];
        assert.ok(
          ops.some((f) => inside(f(p))),
          `${group}: ${p} reaches no op into ${box}`,
        );
      }
    }
  }
});
