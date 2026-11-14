import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DEPTH, accentGeometry, generate, geometry, hasAccent } from '../fractal.ts';
import { isClosed } from '../fills.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const geo = (seed: number, depth: number) => geometry({ kind: 'truchet', seed, depth, size: S });
// A multiple of m, or an odd multiple of m / 2 when half is set; tile edge values count as on grid.
const on = (v: number, m: number, half = false) => {
  const q = (half ? v - m / 2 : v) / m;
  return near(q, Math.round(q));
};

test('truchet depth 4: 32 arcs, and 16 closed dots in the accent hook', () => {
  const g = geo(1, 4);
  assert.equal(g.filter(isClosed).length, 0);
  assert.ok(hasAccent('truchet'));
  const dots = accentGeometry({ kind: 'truchet', seed: 1, depth: 4, size: S });
  assert.equal(dots.length, 16);
  assert.ok(dots.every(isClosed));
  // Each dot centred on a cell corner of the offset grid, radius 15 % of a cell (the design board: 3.5 on 24).
  const c = S / 4;
  for (const d of dots) {
    const cx = d.slice(0, 12).reduce((a, p) => a + p[0], 0) / 12;
    const cy = d.slice(0, 12).reduce((a, p) => a + p[1], 0) / 12;
    assert.ok(on(cx - c / 5, c) && on(cy - c / 5, c), `(${cx}, ${cy})`);
    assert.ok(near(Math.hypot(d[0]![0] - cx, d[0]![1] - cy), 0.15 * c));
  }
  // The grid is offset by a fifth of a cell, so wrap() splits an arc at each tile edge crossing: one more
  // piece per crossing, and each crossing leaves two piece ends on the tile edge (one on each side).
  const open = g.filter((p) => !isClosed(p));
  const onEdge = ([x, y]: readonly [number, number]) => near(x, 0) || near(x, S) || near(y, 0) || near(y, S);
  const edgeEnds = open.flatMap((p) => [p[0]!, p[p.length - 1]!]).filter(onEdge).length;
  assert.ok(edgeEnds > 0);
  assert.equal(open.length, 32 + edgeEnds / 2);
});

test('truchet arc ends: on a cell edge midpoint or on the tile edge', () => {
  const c = S / 4;
  const off = c / 5;
  for (let seed = 1; seed <= 10; seed++) {
    for (const p of geo(seed, 4).filter((q) => !isClosed(q))) {
      for (const [x, y] of [p[0]!, p[p.length - 1]!]) {
        if (near(x, 0) || near(x, S) || near(y, 0) || near(y, S)) continue;
        const u = x - off;
        const v = y - off;
        assert.ok((on(u, c) && on(v, c, true)) || (on(v, c) && on(u, c, true)), `seed ${seed}: (${x}, ${y})`);
      }
    }
  }
});

test('truchet tiles with no seam', () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (let depth = 1; depth <= MAX_DEPTH.truchet; depth++) {
      const msg = `seed ${seed} depth ${depth}`;
      const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
      for (const poly of geo(seed, depth)) {
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
        assert.ok(a.length > 0, `${msg}: ${side} empty`);
        a.forEach((v, i) => assert.ok(near(v, b[i]!), `${msg}: ${side} ${v} vs ${b[i]}`));
      };
      same(cross.x0, cross.xS, 'x');
      same(cross.y0, cross.yS, 'y');
    }
  }
});

test('truchet is deterministic and seeded', () => {
  assert.deepEqual(geo(7, 4), geo(7, 4));
  assert.notDeepEqual(geo(1, 4), geo(2, 4));
  // The dots take no draws: the same for every seed.
  const acc = (seed: number) => accentGeometry({ kind: 'truchet', seed, depth: 4, size: S });
  assert.deepEqual(acc(1), acc(2));
});

test('truchet generates an svg', () => {
  const svg = generate({ kind: 'truchet', seed: 1, depth: 4, size: S, strokeWidth: 1, precision: 1, color: '#336699', opacity: 1 });
  assert.ok(svg.startsWith('<svg'));
});
