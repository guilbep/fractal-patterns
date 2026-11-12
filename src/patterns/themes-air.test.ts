import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_AIR_MAX_DEPTH, chain, chainFamily, featherParts, feathers } from './themes-air.ts';
import { mulberry32, type Generator, type Poly } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const kinds = { feathers, chain } as const;
const run = (gen: Generator, seed: number, depth: number) => gen(mulberry32(seed), depth, S);

function assertSeamless(polys: Poly[], msg: string) {
  const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
  for (const poly of polys) {
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

for (const [kind, gen] of Object.entries(kinds)) {
  const max = THEME_AIR_MAX_DEPTH[kind as keyof typeof kinds];

  test(`${kind} tiles with no seam`, () => {
    for (let seed = 1; seed <= 10; seed++)
      for (let depth = 1; depth <= max; depth++) assertSeamless(run(gen, seed, depth), `${kind} seed ${seed} depth ${depth}`);
  });

  test(`${kind} is deterministic and seeded`, () => {
    assert.deepEqual(run(gen, 7, 3), run(gen, 7, 3));
    assert.notDeepEqual(run(gen, 1, 3), run(gen, 2, 3));
  });

  test(`${kind} stays in the tile with well-formed polylines`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (let depth = 1; depth <= max; depth++) {
        for (const poly of run(gen, seed, depth)) {
          assert.ok(poly.length >= 2, `${kind} seed ${seed} depth ${depth}: short polyline`);
          for (const [x, y] of poly) {
            for (const v of [x, y]) assert.ok(Number.isFinite(v) && v >= -1e-6 && v <= S + 1e-6, `${kind} seed ${seed}: ${v}`);
          }
        }
      }
    }
  });

  test(`${kind} grows with depth`, () => {
    const pts = (d: number) => run(gen, 3, d).reduce((n, p) => n + p.length, 0);
    assert.ok(pts(max) > pts(1), `${pts(1)} -> ${pts(max)}`);
  });
}

// Ray casting, plus "on the outline" within tol.
function inPolygon([x, y]: readonly [number, number], poly: Poly, tol: number): boolean {
  let inside = false;
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1]!;
    const [bx, by] = poly[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= tol) return true;
    if (ay > y !== by > y && x < ax + ((y - ay) * dx) / dy) inside = !inside;
  }
  return inside;
}

test('feather barbs end inside the outline and multiply with depth', () => {
  let prev = 0;
  for (let depth = 1; depth <= THEME_AIR_MAX_DEPTH.feathers; depth++) {
    let count = 0;
    for (const notches of [[], [0.4], [-0.5, 0.65]]) {
      for (const bend of [-0.08, 0, 0.08]) {
        const p = featherParts({ len: 52, half: 13, bend, notches, barbs: 2 + 2 * depth });
        const [f, l] = [p.outline[0]!, p.outline[p.outline.length - 1]!];
        assert.deepEqual(f, l, 'outline is closed');
        for (const barb of p.barbs) for (const pt of barb) assert.ok(inPolygon(pt, p.outline, 0.5), `barb point ${pt} outside`);
        count += p.barbs.length;
      }
    }
    assert.ok(count > prev, `depth ${depth}: ${count} barbs`);
    prev = count;
  }
});

test('chain covers both families, each seamless', () => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  for (const family of ['fence', 'links'] as const) {
    const of = seeds.filter((s) => chainFamily(s) === family);
    assert.ok(of.length > 0, `no ${family} in seeds 1..20`);
    for (const seed of of.slice(0, 5))
      for (let depth = 1; depth <= THEME_AIR_MAX_DEPTH.chain; depth++)
        assertSeamless(run(chain, seed, depth), `${family} seed ${seed} depth ${depth}`);
  }
});
