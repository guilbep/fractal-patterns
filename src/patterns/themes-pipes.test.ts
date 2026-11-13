import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry } from '../fractal.ts';
import { TILES, tileGeometry, wangLayout } from '../wang.ts';
import {
  ENDLESSMAZE_MAX_DEPTH,
  PATHS_MAX_DEPTH,
  PIPES_MAX_DEPTH,
  WEAVE_MAX_DEPTH,
  endlessmaze,
  paths,
  pipes,
  weave,
} from './themes-pipes.ts';
import { mulberry32 } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const KINDS = [
  ['pipes', pipes, PIPES_MAX_DEPTH],
  ['weave', weave, WEAVE_MAX_DEPTH],
  ['paths', paths, PATHS_MAX_DEPTH],
  ['endlessmaze', endlessmaze, ENDLESSMAZE_MAX_DEPTH],
] as const;
type WangKind = (typeof KINDS)[number][0];
const geoOf = (kind: WangKind, seed: number, depth: number) => geometry({ kind, seed, depth, size: S });
const geo = (seed: number, depth: number) => geoOf('pipes', seed, depth);

for (const [kind, , max] of KINDS)
  test(`${kind} tile with no seam`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (let depth = 1; depth <= max; depth++) {
        const msg = `${kind} seed ${seed} depth ${depth}`;
        const cross = {
          x0: [] as number[],
          xS: [] as number[],
          y0: [] as number[],
          yS: [] as number[],
        };
        for (const poly of geoOf(kind, seed, depth)) {
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

for (const [kind, gen, max] of KINDS)
  test(`${kind}: deterministic, seeded, finite and inside the tile, no short polyline, paths grow with depth`, () => {
    const points = (seed: number, depth: number) => geoOf(kind, seed, depth).reduce((n, p) => n + p.length, 0);
    assert.deepEqual(gen(mulberry32(3), 3, S), gen(mulberry32(3), 3, S));
    assert.notDeepEqual(geoOf(kind, 1, 3), geoOf(kind, 2, 3));
    for (let seed = 1; seed <= 10; seed++)
      for (let depth = 1; depth <= max; depth++)
        for (const poly of geoOf(kind, seed, depth)) {
          assert.ok(poly.length >= 2, `seed ${seed} depth ${depth}`);
          for (const [x, y] of poly)
            assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= -1e-9 && x <= S + 1e-9 && y >= -1e-9 && y <= S + 1e-9);
        }
    for (let seed = 1; seed <= 10; seed++) {
      assert.ok(points(seed, max) > points(seed, 1), `seed ${seed}`);
      for (let depth = 2; depth <= max; depth++)
        assert.ok(geoOf(kind, seed, depth).length >= geoOf(kind, seed, depth - 1).length, `seed ${seed} depth ${depth}: path count`);
    }
  });

// Measured at depth 3, seeds 1..5: polylines vs non-empty cells (the cell draws replayed from the same rng).
test('pipes: the join makes fewer polylines than 1.5 per non-empty cell', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const rnd = mulberry32(seed);
    const n = 8;
    const layout = wangLayout(n, Math.floor(rnd() * 4294967296), 0.4 + 0.25 * rnd());
    const cells = layout.filter((t) => tileGeometry('pipes', TILES[t]!, rnd() < 0.5 ? 1 : 0, S / n, false).length > 0).length;
    assert.ok(geo(seed, 3).length < cells * 1.5, `seed ${seed}: ${geo(seed, 3).length} polylines, ${cells} cells`);
  }
});
