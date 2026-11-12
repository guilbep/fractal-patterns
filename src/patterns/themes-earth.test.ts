import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_EARTH_MAX_DEPTH, cracks, crossOnTorus, roots, starLayout, stars } from './themes-earth.ts';
import { pathData } from '../scene.ts';
import { mulberry32, type Poly } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const GEN = { stars, roots, cracks };
const KINDS = ['stars', 'roots', 'cracks'] as const;
const run = (kind: (typeof KINDS)[number], seed: number, depth: number): Poly[] => GEN[kind](mulberry32(seed), depth, S);

test('earth theme kinds tile with no seam', () => {
  for (const kind of KINDS) {
    for (let seed = 1; seed <= 10; seed++) {
      for (let depth = 1; depth <= THEME_EARTH_MAX_DEPTH[kind]; depth++) {
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
  }
});

test('earth theme kinds: deterministic, seeded, finite, in the tile, denser with depth', () => {
  for (const kind of KINDS) {
    const max = THEME_EARTH_MAX_DEPTH[kind];
    assert.ok(max >= 3 && max <= 6, kind);
    assert.deepEqual(run(kind, 7, 3), run(kind, 7, 3), `${kind} deterministic`);
    assert.notDeepEqual(run(kind, 1, 3), run(kind, 2, 3), `${kind} seeds differ`);
    for (let seed = 1; seed <= 10; seed++) {
      for (let depth = 1; depth <= max; depth++) {
        for (const poly of run(kind, seed, depth)) {
          assert.ok(poly.length >= 2, `${kind} seed ${seed} depth ${depth}: short polyline`);
          for (const v of poly.flat()) assert.ok(Number.isFinite(v) && v >= -1e-6 && v <= S + 1e-6, `${kind}: ${v}`);
        }
      }
      const pts = (d: number) => run(kind, seed, d).reduce((s, p) => s + p.length, 0);
      assert.ok(pts(max) > pts(1), `${kind} seed ${seed}: ${pts(1)} -> ${pts(max)} points`);
    }
  }
});

test('stars keep their spacing and constellation lines never cross', () => {
  for (let seed = 1; seed <= 5; seed++) {
    for (let depth = 1; depth <= THEME_EARTH_MAX_DEPTH.stars; depth++) {
      // stars() draws its layout first from the same rng, so this is the drawn layout.
      const { centers, minD, links } = starLayout(mulberry32(seed), depth, S);
      for (let i = 0; i < centers.length; i++)
        for (let j = i + 1; j < centers.length; j++) {
          const dx = Math.abs(centers[i]![0] - centers[j]![0]);
          const dy = Math.abs(centers[i]![1] - centers[j]![1]);
          assert.ok(Math.hypot(Math.min(dx, S - dx), Math.min(dy, S - dy)) >= minD, `seed ${seed} depth ${depth}: stars ${i} ${j}`);
        }
      assert.ok(links.length > 0, `seed ${seed} depth ${depth}: no constellation`);
      for (let i = 0; i < links.length; i++)
        for (let j = i + 1; j < links.length; j++)
          assert.ok(!crossOnTorus(links[i]!, links[j]!, S), `seed ${seed} depth ${depth}: lines ${i} ${j} cross`);
    }
  }
});

test('cracks draw no edge twice', () => {
  const m = (v: number) => (near(v, S) ? 0 : v);
  for (let seed = 1; seed <= 5; seed++) {
    for (let depth = 1; depth <= THEME_EARTH_MAX_DEPTH.cracks; depth++) {
      const ends = run('cracks', seed, depth).map((p) => [p[0]!, p[p.length - 1]!].map(([x, y]) => [m(x), m(y)] as const));
      const eq = (a: readonly number[], b: readonly number[]) => near(a[0]!, b[0]!) && near(a[1]!, b[1]!);
      for (let i = 0; i < ends.length; i++)
        for (let j = i + 1; j < ends.length; j++) {
          const [a, b] = ends[i]!;
          const [c, d] = ends[j]!;
          assert.ok(!((eq(a!, c!) && eq(b!, d!)) || (eq(a!, d!) && eq(b!, c!))), `seed ${seed} depth ${depth}: edges ${i} ${j}`);
        }
    }
  }
});

test('roots end quickly for every seed at the maximum depth', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const t = performance.now();
    run('roots', seed, THEME_EARTH_MAX_DEPTH.roots);
    assert.ok(performance.now() - t < 200, `seed ${seed}`);
  }
});

test('roots: denser at the maximum depth than at depth 3', () => {
  const chars = (seed: number, depth: number) => pathData(run('roots', seed, depth), 1).length;
  for (let seed = 1; seed <= 10; seed++)
    assert.ok(
      chars(seed, THEME_EARTH_MAX_DEPTH.roots) > chars(seed, 3),
      `seed ${seed}: ${chars(seed, 3)} -> ${chars(seed, THEME_EARTH_MAX_DEPTH.roots)}`,
    );
});
