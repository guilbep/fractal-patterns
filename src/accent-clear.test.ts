import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepClear } from './accent-clear.ts';
import { geometry } from './fractal.ts';
import type { Poly, Pt } from './patterns/util.ts';

const dot = (cx: number, cy: number, r = 4, n = 16): Poly =>
  Array.from({ length: n + 1 }, (_, i): Pt => [
    cx + r * Math.cos((2 * Math.PI * (i % n)) / n),
    cy + r * Math.sin((2 * Math.PI * (i % n)) / n),
  ]);
const center = (p: Poly): Pt => {
  const q = p.slice(0, -1);
  return [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length];
};

// Brute force, independent of the grid: the smallest distance from the outline (vertices and edges) of `p` to any
// base segment in the 3 x 3 tiles around it, sampled on the outline every 0.25 px; 0 when a base vertex is inside.
function clearance(p: Poly, base: readonly (readonly Pt[])[], size: number): number {
  const segD = (x: number, y: number, a: Pt, b: Pt) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = dx * dx + dy * dy;
    const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l));
    return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
  };
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < p.length; i++) {
    const [a, b] = [p[i]!, p[i + 1]!];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25));
    for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const c = center(p);
  const rad = Math.min(...pts.map(([x, y]) => Math.hypot(x - c[0], y - c[1])));
  let d = Infinity;
  for (const tx of [-size, 0, size])
    for (const ty of [-size, 0, size])
      for (const line of base)
        for (let i = 0; i + 1 < line.length; i++) {
          const a: Pt = [line[i]![0] + tx, line[i]![1] + ty];
          const b: Pt = [line[i + 1]![0] + tx, line[i + 1]![1] + ty];
          if (segD(c[0], c[1], a, b) < rad) return 0; // a line through the inside of a convex shape
          for (const [x, y] of pts) d = Math.min(d, segD(x, y, a, b));
        }
  return d;
}

test('a dot on a line moves just off it', () => {
  const [out] = keepClear(
    [dot(50, 50)],
    [
      [
        [0, 50],
        [100, 50],
      ],
    ],
    { size: 100, strokeWidth: 2 },
  );
  const [x, y] = center(out!);
  assert.ok(Math.abs(y - 50) >= 6 - 0.5, `y ${y}`);
  assert.ok(Math.hypot(x - 50, y - 50) < 7, `moved ${Math.hypot(x - 50, y - 50)}`);
});

test('a dot already clear stays byte-equal', () => {
  const d = dot(50, 20);
  const [out] = keepClear(
    [d],
    [
      [
        [0, 50],
        [100, 50],
      ],
    ],
    { size: 100, strokeWidth: 2 },
  );
  assert.deepEqual(out, d);
  assert.equal(out, d);
});

test('lines wrap: a line at x = 1 blocks a dot at x = 98 through its copy at x = 101', () => {
  const [out] = keepClear(
    [dot(98, 50)],
    [
      [
        [1, 0],
        [1, 100],
      ],
    ],
    { size: 100, strokeWidth: 2 },
  );
  const [x] = center(out!);
  assert.ok(101 - x >= 6 - 0.5, `x ${x}`);
  assert.ok(Math.max(...out!.map((v) => v[0])) <= 100 + 1e-9, 'stays whole in the tile');
});

test('two dots pushed off the same line do not overlap', () => {
  const out = keepClear(
    [dot(40, 50), dot(60, 50)],
    [
      [
        [0, 50],
        [100, 50],
      ],
    ],
    { size: 100, strokeWidth: 2 },
  );
  const [a, b] = out.map(center);
  assert.ok(Math.hypot(a![0] - b![0], a![1] - b![1]) >= 8 + 1 - 0.5, `${a} ${b}`);
  for (const p of out)
    assert.ok(
      clearance(
        p,
        [
          [
            [0, 50],
            [100, 50],
          ],
        ],
        100,
      ) >=
        2 - 0.5,
    );
});

test('Truchet: dots on a 4 x 4 grid end clear of a stroke 5 base', () => {
  const base = geometry({ kind: 'truchet', seed: 7, depth: 4, size: 96 });
  const dots = Array.from({ length: 16 }, (_, i) => dot(12 + 24 * (i % 4), 12 + 24 * Math.floor(i / 4)));
  const need = 5 / 2 + 1;
  const isBlocked = (p: Poly) => clearance(p, base, 96) < need - 0.5;
  const before = dots.filter(isBlocked).length;
  const out = keepClear(dots, base as Poly[], { size: 96, strokeWidth: 5 });
  const after = out.filter(isBlocked).length;
  console.log(`truchet blocked before ${before}, after ${after}`);
  assert.equal(after, 0);
});

test('same input, same output', () => {
  const base = geometry({ kind: 'tree', seed: 3, depth: 8, size: 120 }) as Poly[];
  const dots = Array.from({ length: 16 }, (_, i) => dot(15 + 30 * (i % 4), 15 + 30 * Math.floor(i / 4)));
  assert.deepEqual(keepClear(dots, base, { size: 120, strokeWidth: 3 }), keepClear(dots, base, { size: 120, strokeWidth: 3 }));
});

// The tree at depth 8 has 255 segments; Hilbert at depth 6 has about 2000 and blocks every dot (the worst case).
for (const [kind, depth] of [
  ['tree', 8],
  ['hilbert', 6],
] as const)
  test(`speed: 64 dots against the ${kind} base`, () => {
    const base = geometry({ kind, seed: 3, depth, size: 120 }) as Poly[];
    const segs = base.reduce((s, p) => s + p.length - 1, 0);
    const dots = Array.from({ length: 64 }, (_, i) => dot(7.5 + 15 * (i % 8), 7.5 + 15 * Math.floor(i / 8), 3));
    keepClear(dots, base, { size: 120, strokeWidth: 3 }); // warm up
    const t = performance.now();
    keepClear(dots, base, { size: 120, strokeWidth: 3 });
    const ms = performance.now() - t;
    console.log(`${kind}: ${segs} segments, 64 dots, ${ms.toFixed(1)} ms`);
    assert.ok(ms < 200, `${ms} ms`);
  });
