import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry } from '../fractal.ts';
import { GROUP_OPS, type Op } from './symmetry.ts';
import { mulberry32, type Pt } from './util.ts';

const eps = 1e-9;
const samples = (): Pt[] => {
  const rnd = mulberry32(7);
  return Array.from({ length: 50 }, (): Pt => [rnd(), rnd()]);
};
const near = (a: Pt, b: Pt, msg: string): void => assert.ok(Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps, `${msg}: ${a} vs ${b}`);
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
  for (const kind of ['p1', 'p2', 'pm', 'pg'] as const) {
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
  for (const [group, count] of [['p1', 1], ['p2', 2], ['pm', 2], ['pg', 2]] as const) assert.equal(GROUP_OPS[group]?.length, count, group);
});
