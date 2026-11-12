import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME_WATER_MAX_DEPTH, rain, ridgeLines, ridges, seigaiha, seigaihaParts } from './themes-water.ts';
import { mulberry32, type Generator, type Poly, type Pt } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const KINDS: Record<keyof typeof THEME_WATER_MAX_DEPTH, Generator> = { seigaiha, rain, ridges };
const run = (gen: Generator, seed: number, depth: number) => gen(mulberry32(seed), depth, S);

function assertSeamless(polys: Poly[], msg: string): void {
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

for (const [kind, gen] of Object.entries(KINDS)) {
  const max = THEME_WATER_MAX_DEPTH[kind as keyof typeof THEME_WATER_MAX_DEPTH];

  test(`${kind} tiles with no seam`, () => {
    for (let seed = 1; seed <= 10; seed++)
      for (let depth = 1; depth <= max; depth++) assertSeamless(run(gen, seed, depth), `${kind} seed ${seed} depth ${depth}`);
  });

  test(`${kind} is deterministic and seeded`, () => {
    assert.deepEqual(run(gen, 7, 3), run(gen, 7, 3));
    assert.notDeepEqual(run(gen, 1, 3), run(gen, 2, 3));
  });

  test(`${kind} stays in the tile with finite coords and at least 2 points per line`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (let depth = 1; depth <= max; depth++) {
        for (const poly of run(gen, seed, depth)) {
          assert.ok(poly.length >= 2, `${kind} seed ${seed} depth ${depth}: short polyline`);
          for (const [x, y] of poly)
            for (const v of [x, y])
              assert.ok(Number.isFinite(v) && v >= -1e-6 && v <= S + 1e-6, `${kind} seed ${seed} depth ${depth}: ${v}`);
        }
      }
    }
  });

  test(`${kind} gets denser with depth`, () => {
    for (let seed = 1; seed <= 10; seed++) {
      const pts = (d: number) => run(gen, seed, d).reduce((s, p) => s + p.length, 0);
      assert.ok(pts(max) > pts(1), `${kind} seed ${seed}: ${pts(1)} -> ${pts(max)}`);
    }
  });
}

test('seigaiha draws no hidden part of a fan', () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (let depth = 1; depth <= THEME_WATER_MAX_DEPTH.seigaiha; depth++) {
      const { R, centers, arcs } = seigaihaParts(mulberry32(seed), depth, S);
      const all = centers.flatMap(([x, y]) => [-S, 0, S].flatMap((ox) => [-S, 0, S].map((oy): Pt => [x + ox, y + oy])));
      for (const { c, poly } of arcs)
        for (const [x, y] of poly)
          for (const [fx, fy] of all)
            if (fy > c[1] + 1e-9)
              assert.ok(
                !(y < fy && Math.hypot(x - fx, y - fy) < R - 1e-6),
                `seed ${seed} depth ${depth}: (${x}, ${y}) under fan (${fx}, ${fy})`,
              );
    }
  }
});

const crosses = (a: Pt, b: Pt, c: Pt, d: Pt): boolean => {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};

test('rain strokes never cross', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const polys = run(rain, seed, THEME_WATER_MAX_DEPTH.rain);
    const segs = polys.flatMap((p, k) => p.slice(1).map((q, i) => [k, p[i]!, q] as const));
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 1; j < segs.length; j++)
        if (segs[i]![0] !== segs[j]![0])
          assert.ok(!crosses(segs[i]![1], segs[i]![2], segs[j]![1], segs[j]![2]), `seed ${seed}: ${i} x ${j}`);
  }
});

test('ridges keep their order at every x', () => {
  const yAt = (poly: Poly, x: number): number => {
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1]!;
      const [bx, by] = poly[i]!;
      if (x >= ax && x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax || 1);
    }
    throw new Error(`no ridge at ${x}`);
  };
  for (let seed = 1; seed <= 20; seed++) {
    for (let depth = 1; depth <= THEME_WATER_MAX_DEPTH.ridges; depth++) {
      const { ridges: rs } = ridgeLines(mulberry32(seed), depth, S);
      for (let x = 0; x <= S; x += 0.5) {
        const ys = rs.map((r) => yAt(r, x));
        ys.push(ys[0]! + S); // the first ridge of the next tile down
        for (let k = 1; k < ys.length; k++) assert.ok(ys[k]! > ys[k - 1]!, `seed ${seed} depth ${depth} x ${x}: ridge ${k}`);
      }
    }
  }
});
