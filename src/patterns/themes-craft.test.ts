import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_CRAFT_MAX_DEPTH, knot, knotCrossings, roof, roofShape } from './themes-craft.ts';
import { mulberry32, type Generator, type Poly } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const kinds = { knot, roof } as const satisfies Record<keyof typeof THEME_CRAFT_MAX_DEPTH, Generator>;
const run = (kind: keyof typeof kinds, seed: number, depth: number) => kinds[kind](mulberry32(seed), depth, S);

for (const kind of ['knot', 'roof'] as const) {
  const max = THEME_CRAFT_MAX_DEPTH[kind];

  test(`${kind} tiles with no seam`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (let depth = 1; depth <= max; depth++) {
        const msg = `${kind} seed ${seed} depth ${depth}`;
        const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
        for (const poly of run(kind, seed, depth)) {
          for (let i = 1; i < poly.length; i++) {
            const [ax, ay] = poly[i - 1]!;
            const [bx, by] = poly[i]!;
            for (const e of [0, S]) {
              assert.ok(!(near(ax, e) && near(bx, e)), `${msg}: segment on x = ${e}`);
              assert.ok(!(near(ay, e) && near(by, e)), `${msg}: segment on y = ${e}`);
            }
          }
          for (const [x, y] of poly) {
            if (near(x, 0)) cross.x0.push(y);
            if (near(x, S)) cross.xS.push(y);
            if (near(y, 0)) cross.y0.push(x);
            if (near(y, S)) cross.yS.push(x);
          }
        }
        const same = (a: number[], b: number[], side: string) => {
          a.sort((p, q) => p - q);
          b.sort((p, q) => p - q);
          assert.equal(a.length, b.length, `${msg}: ${side} count`);
          a.forEach((v, i) => assert.ok(near(v, b[i]!), `${msg}: ${side} ${v} vs ${b[i]}`));
        };
        same(cross.x0, cross.xS, 'x');
        same(cross.y0, cross.yS, 'y');
      }
    }
  });

  test(`${kind} is deterministic, seeded, in range, rising with depth`, () => {
    assert.deepEqual(run(kind, 7, 3), run(kind, 7, 3));
    assert.notDeepEqual(run(kind, 1, 3), run(kind, 2, 3));
    for (let seed = 1; seed <= 10; seed++) {
      const points = (polys: Poly[]) => polys.reduce((n, p) => n + p.length, 0);
      assert.ok(points(run(kind, seed, max)) > points(run(kind, seed, 1)), `seed ${seed}: points rise with depth`);
      for (let depth = 1; depth <= max; depth++) {
        for (const poly of run(kind, seed, depth)) {
          assert.ok(poly.length >= 2, `seed ${seed} depth ${depth}: short polyline`);
          for (const v of poly.flat()) assert.ok(Number.isFinite(v) && v >= -1e-6 && v <= S + 1e-6, `seed ${seed} depth ${depth}: ${v}`);
        }
      }
    }
  });
}

// Distance from point (x, y) to segment ab, and whether ab runs along direction (dx, dy).
const segDist = (x: number, y: number, [ax, ay]: readonly number[], [bx, by]: readonly number[]) => {
  const vx = bx! - ax!;
  const vy = by! - ay!;
  const t = Math.max(0, Math.min(1, ((x - ax!) * vx + (y - ay!) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(ax! + t * vx - x, ay! + t * vy - y);
};
const along = ([ax, ay]: readonly number[], [bx, by]: readonly number[], dx: number, dy: number) => {
  const vx = bx! - ax!;
  const vy = by! - ay!;
  return Math.abs(vx * dy - vy * dx) < 1e-6 * Math.hypot(vx, vy);
};

test('knot: at every crossing the over strand is continuous and the under strand has a gap', () => {
  const dirs = { '/': [1, -1], '\\': [1, 1] } as const;
  for (let seed = 1; seed <= 10; seed++) {
    for (let depth = 1; depth <= THEME_CRAFT_MAX_DEPTH.knot; depth++) {
      const polys = knot(mulberry32(seed), depth, S);
      const crossings = knotCrossings(mulberry32(seed), depth, S).filter((c) => c.over);
      assert.ok(crossings.length > 0);
      for (const { x, y, over, r } of crossings) {
        const [ox, oy] = dirs[over!];
        const [ux, uy] = over === '/' ? dirs['\\'] : dirs['/'];
        let overHit = false;
        for (const poly of polys) {
          for (let i = 1; i < poly.length; i++) {
            const d = segDist(x, y, poly[i - 1]!, poly[i]!);
            if (d < 1e-6 && along(poly[i - 1]!, poly[i]!, ox, oy)) overHit = true;
            assert.ok(
              !(d < r * 0.99 && along(poly[i - 1]!, poly[i]!, ux, uy)),
              `seed ${seed} depth ${depth}: under strand in the gap at ${x},${y}`,
            );
          }
        }
        assert.ok(overHit, `seed ${seed} depth ${depth}: no over strand at ${x},${y}`);
      }
    }
  }
});

test('knot: over and under alternate along a thread', () => {
  const crossings = knotCrossings(mulberry32(3), 3, S, false);
  assert.ok(crossings.every((c) => c.wall === null));
  const at = (a: number, b: number) => crossings.find((c) => c.a === a && c.b === b)!;
  // A '/' thread runs from (a, b) to (a + 1, b - 1); a + b stays odd along it.
  const run = [0, 1, 2, 3].map((s) => at(1 + s, 6 - s).over === '/');
  assert.deepEqual(run, [false, true, false, true]);
  const run2 = [0, 1, 2, 3].map((s) => at(s, 1 + s).over === '\\');
  assert.deepEqual(run2, [false, true, false, true]);
});

test('roof: tiles in a row do not overlap and all three shapes occur', () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (let depth = 1; depth <= THEME_CRAFT_MAX_DEPTH.roof; depth++) {
      const rows = new Map<number, [number, number][]>();
      for (const poly of roof(mulberry32(seed), depth, S)) {
        const [f, l] = [poly[0]!, poly[poly.length - 1]!];
        if (poly.length < 4 || f[0] !== l[0] || f[1] !== l[1]) continue;
        const xs = poly.map((p) => p[0]);
        const top = Math.round(Math.min(...poly.map((p) => p[1])) * 1e3);
        rows.set(top, [...(rows.get(top) ?? []), [Math.min(...xs), Math.max(...xs)]]);
      }
      assert.ok(rows.size > 0);
      for (const spans of rows.values()) {
        spans.sort((p, q) => p[0] - q[0]);
        for (let i = 1; i < spans.length; i++) assert.ok(spans[i - 1]![1] <= spans[i]![0] + 1e-6, `seed ${seed} depth ${depth}: overlap`);
      }
    }
  }
  const shapes = new Set(Array.from({ length: 20 }, (_, i) => roofShape(mulberry32(i + 1))));
  assert.equal(shapes.size, 3);
});
