import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry } from '../fractal.ts';
import {
  apply,
  GROUP_OPS,
  GROUP_REGION,
  HEX_OPS,
  HEX_REGION,
  hexCells,
  hexMotif,
  hexOrbit,
  hexWallpaper,
  type Mat,
  type Op,
} from './symmetry.ts';
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

// Hexagonal groups: lattice a = (1, 0), b = (1/2, sqrt(3)/2).
const S3 = Math.sqrt(3);
const HEX = ['p3', 'p3m1', 'p31m', 'p6', 'p6m'] as const;
// Lattice coordinates of p modulo 1: p = u a + v b.
const lat = ([x, y]: Pt): Pt => {
  const v = (2 * y) / S3;
  const u = x - v / 2;
  return [u - Math.floor(u), v - Math.floor(v)];
};
const sameModLattice = (p: Pt, q: Pt, tol = 1e-6): boolean => {
  const [du, dv] = [lat(p)[0] - lat(q)[0], lat(p)[1] - lat(q)[1]];
  const r = (d: number) => d - Math.round(d);
  const [ru, rv] = [r(du), r(dv)];
  return Math.hypot(ru + rv / 2, (rv * S3) / 2) < tol;
};
// Point set modulo the lattice, bucketed on a 1e-4 grid of lattice coordinates.
const pointSet = (pts: readonly Pt[]) => {
  const g = 1e4;
  const m = new Map<string, Pt[]>();
  const key = (i: number, j: number) => `${((i % g) + g) % g},${((j % g) + g) % g}`;
  for (const p of pts) {
    const [u, v] = lat(p);
    const k = key(Math.floor(u * g), Math.floor(v * g));
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return (p: Pt): boolean => {
    const [u, v] = lat(p);
    const [i, j] = [Math.floor(u * g), Math.floor(v * g)];
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) if ((m.get(key(i + di, j + dj)) ?? []).some((q) => sameModLattice(p, q))) return true;
    return false;
  };
};
const det = (m: Mat) => m[0] * m[3] - m[1] * m[2];
const inverse = (m: Mat): Mat => [m[3] / det(m), -m[1] / det(m), -m[2] / det(m), m[0] / det(m)];
// Signed distance inside a convex counter-clockwise polygon (positive inside).
const depthIn = (poly: readonly Pt[], [x, y]: Pt): number =>
  Math.min(
    ...poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      return ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
    }),
  );
const region = (g: string) => HEX_REGION[g] ?? [];
const ops = (g: string) => HEX_OPS[g] ?? [];

test('hex: op counts, regions counter-clockwise, every motif point inside its region', () => {
  assert.deepEqual(
    HEX.map((g) => ops(g).length),
    [3, 6, 6, 6, 12],
  );
  for (const g of HEX) {
    const r = region(g);
    assert.ok(
      r.every((a, i) => depthIn([a, r[(i + 1) % r.length]!, r[(i + 2) % r.length]!], a) >= -eps),
      g,
    );
    for (let seed = 1; seed <= 5; seed++)
      for (let depth = 1; depth <= 3; depth++)
        for (const p of hexMotif(g, mulberry32(seed), depth).flat()) assert.ok(depthIn(r, p) >= -1e-9, `${g} ${seed} ${depth}: ${p}`);
  }
});

test('hex: every op maps the orbit and the tile output onto the orbit modulo the lattice', () => {
  for (const g of HEX)
    for (let seed = 1; seed <= 5; seed++)
      for (let depth = 1; depth <= 3; depth++) {
        const orbit = hexOrbit(g, hexMotif(g, mulberry32(seed), depth - 1)).flat();
        const has = pointSet(orbit);
        const size = 120;
        const k = size / hexCells(depth);
        // Tile points off the border are original orbit points (clipping only adds border points).
        const tile = hexWallpaper(g)(mulberry32(seed), depth, size)
          .flat()
          .filter(([x, y]) => x > 1e-6 && x < size - 1e-6 && y > 1e-6 && y < size * S3 - 1e-6);
        const rnd = mulberry32(seed * 31 + depth);
        const pick = (pts: readonly Pt[]) => Array.from({ length: 40 }, () => pts[Math.floor(rnd() * pts.length)]!);
        const pts = [...pick(orbit), ...pick(tile).map(([x, y]): Pt => [x / k, y / k])];
        for (const p of pts) {
          assert.ok(has(p), `${g} ${seed} ${depth}: ${p} not on the orbit`);
          for (const m of ops(g)) assert.ok(has(apply(m, p)), `${g} ${seed} ${depth}: image of ${p}`);
        }
      }
});

test('hex: a generic point has 3, 6 or 12 distinct images per cell; the region tiles the cell', () => {
  for (const g of HEX) {
    const r = region(g);
    const c: Pt = [r.reduce((s, p) => s + p[0], 0) / r.length + 0.01, r.reduce((s, p) => s + p[1], 0) / r.length + 0.003];
    const imgs = ops(g).map((m) => apply(m, c));
    for (let i = 0; i < imgs.length; i++)
      for (let j = i + 1; j < imgs.length; j++) assert.ok(!sameModLattice(imgs[i]!, imgs[j]!, 1e-3), `${g} ${i} ${j}`);
    const rnd = mulberry32(11);
    let checked = 0;
    for (let s = 0; s < 200; s++) {
      const [u, v] = [rnd(), rnd()];
      const p: Pt = [u + v / 2, (v * S3) / 2];
      let count = 0;
      let border = false;
      for (const m of ops(g))
        for (let i = -3; i <= 3; i++)
          for (let j = -3; j <= 3; j++) {
            const d = depthIn(r, apply(inverse(m), [p[0] - i - j / 2, p[1] - (j * S3) / 2]));
            if (Math.abs(d) < 1e-6) border = true;
            else if (d > 0) count++;
          }
      if (border) continue;
      checked++;
      assert.equal(count, 1, `${g}: ${p}`);
    }
    assert.ok(checked > 190, `${g}: ${checked}`);
  }
});

test('hex: p3m1 and p31m differ: a triangle center lies on a p3m1 mirror, on no p31m mirror', () => {
  const c: Pt = [0.5, S3 / 6];
  const fixed = (g: string) => ops(g).filter((m) => det(m) < 0 && sameModLattice(apply(m, c), c));
  assert.ok(fixed('p3m1').length > 0);
  assert.equal(fixed('p31m').length, 0);
});

const near2 = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const assertSeamless = (polys: readonly (readonly Pt[])[], S: number, msg: string, SY = S) => {
  const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
  for (const poly of polys) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1]!;
      const [bx, by] = poly[i]!;
      for (const e of [0, S]) assert.ok(!(near2(ax, e) && near2(bx, e)), `${msg}: segment on x = ${e}`);
      for (const e of [0, SY]) assert.ok(!(near2(ay, e) && near2(by, e)), `${msg}: segment on y = ${e}`);
    }
    for (const [x, y] of poly) {
      if (near2(x, 0)) cross.x0.push(y);
      if (near2(x, S)) cross.xS.push(y);
      if (near2(y, 0)) cross.y0.push(x);
      if (near2(y, SY)) cross.yS.push(x);
    }
  }
  const same = (a: number[], b: number[], side: string) => {
    a.sort((p, q) => p - q);
    b.sort((p, q) => p - q);
    assert.equal(a.length, b.length, `${msg}: ${side} count`);
    a.forEach((v, i) => assert.ok(near2(v, b[i]!), `${msg}: ${side} ${v} vs ${b[i]}`));
  };
  same(cross.x0, cross.xS, 'x');
  same(cross.y0, cross.yS, 'y');
};

test('hex: seamless on the rectangle, deterministic, seeded, inside the tile, motif covers the region', () => {
  const T = 120;
  for (const g of HEX) {
    const gen = hexWallpaper(g);
    for (let seed = 1; seed <= 5; seed++)
      for (let depth = 1; depth <= 3; depth++) {
        const polys = gen(mulberry32(seed), depth, T);
        const msg = `${g} seed ${seed} depth ${depth}`;
        assertSeamless(polys, T, msg, T * S3);
        for (const [x, y] of polys.flat()) assert.ok(x >= -1e-9 && x <= T + 1e-9 && y >= -1e-9 && y <= T * S3 + 1e-9, msg);
        assert.deepEqual(polys, gen(mulberry32(seed), depth, T), msg);
        assert.notDeepEqual(polys, gen(mulberry32(seed + 1), depth, T), msg);
        // Coverage: most sample points of the region lie near the motif (a quarter of the region's size).
        const r = region(g);
        const motif = hexMotif(g, mulberry32(seed), depth - 1).flat();
        const reach = 0.25 * Math.max(...r.map((p) => Math.max(...r.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])))));
        const rnd = mulberry32(5);
        let inside = 0;
        let close = 0;
        while (inside < 100) {
          const p: Pt = [rnd() * 1.2 - 0.1, rnd() * 0.8 - 0.4];
          if (depthIn(r, p) <= 0) continue;
          inside++;
          if (motif.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < reach)) close++;
        }
        assert.ok(close >= 80, `${msg}: ${close}`);
      }
  }
});
