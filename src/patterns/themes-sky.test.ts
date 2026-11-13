import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_SKY_MAX_DEPTH, clouds, moonPhase, moons, storm } from './themes-sky.ts';
import { mulberry32, type Generator, type Poly } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const kinds = { clouds, moons, storm } as const;
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
  const max = THEME_SKY_MAX_DEPTH[kind as keyof typeof kinds];

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

  test(`${kind} path count grows or stays with depth`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      let prev = 0;
      for (let depth = 1; depth <= max; depth++) {
        const n = run(gen, seed, depth).length;
        assert.ok(n >= prev, `seed ${seed} depth ${depth}: ${prev} -> ${n}`);
        prev = n;
      }
    }
  });
}

test('moon phases close and grow from crescent to full', () => {
  // Shoelace area of the lit outline.
  const area = (phi: number) => {
    const m = moonPhase(0, 0, 10, phi);
    assert.deepEqual(m[0], m[m.length - 1], 'closed outline');
    return Math.abs(m.reduce((a, [x, y], i) => (i ? a + m[i - 1]![0] * y - x * m[i - 1]![1] : a), 0)) / 2;
  };
  const [crescent, half, gibbous, full] = [0.3, 0.5, 0.8, 1].map((f) => area(f * Math.PI)) as [number, number, number, number];
  assert.ok(crescent < half && half < gibbous && gibbous < full, `${crescent} ${half} ${gibbous} ${full}`);
});
