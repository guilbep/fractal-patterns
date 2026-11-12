import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DEPTH, geometry } from '../fractal.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

test('theme kinds tile with no seam', () => {
  for (const kind of ['topo', 'maze', 'circuit'] as const) {
    for (let seed = 1; seed <= 20; seed++) {
      for (let depth = 1; depth <= MAX_DEPTH[kind]; depth++) {
        const msg = `${kind} seed ${seed} depth ${depth}`;
        const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
        for (const poly of geometry({ kind, seed, depth, size: S })) {
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

test('maze walls form a spanning tree on the torus', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (let depth = 1; depth <= MAX_DEPTH.maze; depth++) {
      const n = 4 + 2 * depth;
      let len = 0;
      for (const poly of geometry({ kind: 'maze', seed, depth, size: S }))
        for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i]![0] - poly[i - 1]![0], poly[i]![1] - poly[i - 1]![1]);
      assert.ok(Math.abs(len - ((n * n + 1) * S) / n) < 1e-6, `seed ${seed} depth ${depth}: ${len}`);
    }
  }
});
