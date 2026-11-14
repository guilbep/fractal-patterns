import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DEPTH, accentGeometry, generate, geometry, hasAccent } from '../fractal.ts';
import { isClosed } from '../fills.ts';
import { sprigParts } from './themes-sprigs.ts';
import { mulberry32 } from './util.ts';

const S = 120;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const geo = (seed: number, depth: number) => geometry({ kind: 'sprigs', seed, depth, size: S });
const acc = (seed: number, depth: number) => accentGeometry({ kind: 'sprigs', seed, depth, size: S });
const base = { kind: 'sprigs', seed: 1, depth: 2, size: S, strokeWidth: 1, precision: 1, color: '#336699', opacity: 1 } as const;

test('sprigs has accent shapes, tree has none', () => {
  assert.equal(hasAccent('sprigs'), true);
  assert.equal(hasAccent('tree'), false);
});

test('sprigs depth 2: closed berries as accent, one count per sprig, closed leaves', () => {
  const parts = sprigParts(mulberry32(5), 2, S);
  assert.equal(parts.counts.length, 9); // (depth + 1)^2 sprigs
  assert.ok(
    parts.counts.every((n) => n >= 2 && n <= 4),
    parts.counts.join(),
  );
  const a = acc(5, 2);
  assert.equal(
    a.length,
    parts.counts.reduce((s, n) => s + n, 0),
  );
  assert.ok(a.every(isClosed));
  assert.ok(a.every((p) => p.length === 11));
  // Main geometry: the leaves are its closed shapes (2 or 3 per sprig, 13 points each), berries are not in it.
  const closed = geo(5, 2).filter(isClosed);
  assert.equal(closed.length, parts.leaves.length);
  assert.ok(closed.length >= 18 && closed.length <= 27, `${closed.length}`);
  assert.ok(closed.every((p) => p.length === 13));
});

test('sprigs leaves and berries stay whole inside the tile', () => {
  for (let seed = 1; seed <= 10; seed++)
    for (let depth = 1; depth <= MAX_DEPTH.sprigs; depth++)
      for (const p of [...geo(seed, depth).filter(isClosed), ...acc(seed, depth)])
        for (const [x, y] of p) assert.ok(x > 0 && x < S && y > 0 && y < S, `seed ${seed} depth ${depth}: (${x}, ${y})`);
});

test('sprigs tiles with no seam', () => {
  let crossings = 0;
  for (let seed = 1; seed <= 10; seed++) {
    for (let depth = 1; depth <= MAX_DEPTH.sprigs; depth++) {
      const msg = `seed ${seed} depth ${depth}`;
      const cross = { x0: [] as number[], xS: [] as number[], y0: [] as number[], yS: [] as number[] };
      for (const poly of [...geo(seed, depth), ...acc(seed, depth)]) {
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
      crossings += cross.x0.length + cross.y0.length;
    }
  }
  // Stems do cross the edges: the check above is not vacuous.
  assert.ok(crossings > 0);
});

test('sprigs svg carries the accent color, and falls back to the stroke color without it', () => {
  const svg = generate({ ...base, accent: '#e07a3f' });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('#e07a3f'));
  const plain = generate(base);
  assert.ok(plain.startsWith('<svg'));
  assert.ok(!plain.includes('#e07a3f'));
  assert.ok(plain.includes('#336699'));
});

test('sprigs is deterministic and seeded', () => {
  assert.deepEqual(geo(7, 3), geo(7, 3));
  assert.deepEqual(acc(7, 3), acc(7, 3));
  assert.notDeepEqual(geo(1, 3), geo(2, 3));
  assert.notDeepEqual(acc(1, 3), acc(2, 3));
});
