import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHLADNI_MAX_DEPTH, chladni, chladniField, chladniLines } from './themes-chladni.ts';
import { mulberry32, type Poly } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const gen = (seed: number, depth: number): Poly[] => chladni(mulberry32(seed), depth, S);
const length = (polys: Poly[]): number => {
  let len = 0;
  for (const poly of polys)
    for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i]![0] - poly[i - 1]![0], poly[i]![1] - poly[i - 1]![1]);
  return len;
};

test('chladni tiles with no seam', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (let depth = 1; depth <= CHLADNI_MAX_DEPTH; depth++) {
      const msg = `seed ${seed} depth ${depth}`;
      const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
      for (const poly of gen(seed, depth)) {
        assert.ok(poly.length >= 2, `${msg}: short polyline`);
        for (let i = 1; i < poly.length; i++) {
          const [ax, ay] = poly[i - 1]!;
          const [bx, by] = poly[i]!;
          for (const e of [0, S]) {
            assert.ok(!(near(ax, e) && near(bx, e)), `${msg}: segment on x = ${e}`);
            assert.ok(!(near(ay, e) && near(by, e)), `${msg}: segment on y = ${e}`);
          }
        }
        for (const [x, y] of poly) {
          assert.ok(Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= S && y >= 0 && y <= S, `${msg}: ${x}, ${y}`);
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

test('chladni is deterministic and seeded', () => {
  assert.deepEqual(gen(1, 3), gen(1, 3));
  assert.notDeepEqual(gen(1, 3), gen(2, 3));
});

test('chladni points lie on the nodal set', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const { f, amp } = chladniField(mulberry32(seed), 3);
    for (const poly of gen(seed, 3))
      for (const [x, y] of poly) assert.ok(Math.abs(f(x / S, y / S)) < 0.03 * amp, `seed ${seed}: f(${x}, ${y}) = ${f(x / S, y / S)}`);
  }
});

test('chladni with b = 0 and s = +1 is symmetric under x <-> y', () => {
  const lines = chladniLines({ n: 1, m: 3, k: 1, l: 2, s: 1, s2: 1, a: 1, b: 0, pu: 0, pv: 0, eps: 1e-4 }, S);
  const segDist = (px: number, py: number): number => {
    let best = Infinity;
    for (const poly of lines) {
      for (let i = 1; i < poly.length; i++) {
        const [ax, ay] = poly[i - 1]!;
        const [bx, by] = poly[i]!;
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
      }
    }
    return best;
  };
  assert.ok(lines.length >= 2);
  for (const poly of lines) for (const [x, y] of poly) assert.ok(segDist(y, x) < 0.6, `mirror of ${x}, ${y}`);
});

test('chladni gets denser with depth', () => {
  let count = 0;
  for (let seed = 1; seed <= 10; seed++) if (length(gen(seed, 5)) > length(gen(seed, 1))) count++;
  assert.ok(count >= 8, `denser at depth 5 for ${count} of 10 seeds`);
});
