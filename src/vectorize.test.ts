import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generate, geometry, svgFromPolylines, type PatternParams } from './fractal.ts';
import { edges, toGray } from './trace.ts';
import { chains, simplify, vectorize } from './vectorize.ts';
import type { Pt } from './patterns/util.ts';

function grid(width: number, height: number, on: (x: number, y: number) => boolean): Uint8Array {
  const m = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (on(x, y)) m[y * width + x] = 1;
  return m;
}

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('simplify', () => {
  assert.deepEqual(
    simplify(
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
      0.1,
    ),
    [
      [0, 0],
      [4, 0],
    ],
  );
  assert.deepEqual(
    simplify(
      [
        [0, 0],
        [5, 0],
        [10, 0],
        [10, 5],
        [10, 10],
      ],
      0.5,
    ),
    [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
  );
  const poly: Pt[] = [
    [0, 0],
    [1, 0.2],
    [2, 0],
  ];
  const copy = simplify(poly, 0);
  assert.deepEqual(copy, poly);
  assert.notEqual(copy, poly);
  assert.deepEqual(
    simplify(
      [
        [0, 0],
        [3, 4],
      ],
      1,
    ),
    [
      [0, 0],
      [3, 4],
    ],
  );
});

test('chains: horizontal run', () => {
  const cs = chains(
    grid(12, 5, (x, y) => y === 2 && x >= 1 && x <= 10),
    12,
    5,
  );
  assert.equal(cs.length, 1);
  const c = cs[0] ?? [];
  assert.equal(c.length, 10);
  const xs = [c[0]?.[0], c[c.length - 1]?.[0]].sort();
  assert.deepEqual(xs, [1.5, 10.5].sort());
  assert.ok(c.every(([, y]) => y === 2.5));
});

test('chains: square outline', () => {
  const edge = (v: number) => v === 2 || v === 5;
  const inside = (v: number) => v >= 2 && v <= 5;
  const on = (x: number, y: number) => inside(x) && inside(y) && (edge(x) || edge(y));
  const cs = chains(grid(8, 8, on), 8, 8);
  const pts = cs.flat();
  assert.equal(pts.length, 12);
  const keys = new Set(pts.map(([x, y]) => `${x},${y}`));
  assert.equal(keys.size, 12);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (on(x, y)) assert.ok(keys.has(`${x + 0.5},${y + 0.5}`));
});

test('chains: isolated pixel and empty map', () => {
  assert.deepEqual(
    chains(
      grid(5, 5, (x, y) => x === 2 && y === 3),
      5,
      5,
    ),
    [[[2.5, 3.5]]],
  );
  assert.deepEqual(chains(new Uint8Array(25), 5, 5), []);
});

const vertical = (x: number, y: number) => x === 8 && y >= 1 && y <= 6;
const opts = { size: 120, tolerance: 1, minLength: 4 };

test('vectorize: scale and center', () => {
  const ps = vectorize(grid(16, 8, vertical), 16, 8, opts);
  assert.equal(ps.length, 1);
  const p = ps[0] ?? [];
  assert.equal(p.length, 2);
  assert.ok(p.every(([x, y]) => x >= 0 && x <= 120 && y >= 0 && y <= 120));
  for (const [x] of p) near(x, 63.75);
  const ys = p.map(([, y]) => y).sort((a, b) => a - b);
  near(ys[0] ?? NaN, 41.25);
  near(ys[1] ?? NaN, 78.75);
});

test('vectorize drops noise', () => {
  const ps = vectorize(
    grid(16, 8, (x, y) => vertical(x, y) || (x === 1 && y === 7)),
    16,
    8,
    opts,
  );
  assert.equal(ps.length, 1);
});

test('vectorize: end to end on a white square', () => {
  const n = 32;
  const rgba: number[] = [];
  const inSquare = (v: number) => v >= 10 && v <= 21;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = inSquare(x) && inSquare(y) ? 255 : 0;
      rgba.push(v, v, v, 255);
    }
  const ps = vectorize(edges(toGray(rgba, n, n), 'canny', 0.3), n, n, { size: 120, tolerance: 1, minLength: 6 });
  assert.ok(ps.length >= 1);
  const pts = ps.flat();
  assert.ok(pts.every(([x, y]) => x >= 0 && x <= 120 && y >= 0 && y <= 120));
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  for (const v of [Math.min(...xs), Math.min(...ys)]) near(v, 37.5, 6);
  for (const v of [Math.max(...xs), Math.max(...ys)]) near(v, 82.5, 6);
});

test('svgFromPolylines', () => {
  const svg = svgFromPolylines(
    [
      [
        [0, 0],
        [10, 0],
      ],
    ],
    { size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 },
  );
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('#336699'));
  assert.ok(svg.includes('viewBox="0 0 120 120"'));
  for (const kind of ['carpet', 'tree', 'hilbert'] as const) {
    const p: PatternParams = { kind, seed: 7, depth: 3, size: 200, strokeWidth: 1, precision: 2, color: '#000', opacity: 1 };
    assert.equal(generate(p), svgFromPolylines(geometry(p), p), kind);
  }
});

test('vectorize cover: fills the tile', () => {
  const ps = vectorize(grid(16, 8, vertical), 16, 8, { ...opts, fit: 'cover' });
  assert.equal(ps.length, 1);
  const p = ps[0] ?? [];
  assert.equal(p.length, 2);
  for (const [x] of p) near(x, 67.5);
  const ys = p.map(([, y]) => y).sort((a, b) => a - b);
  near(ys[0] ?? NaN, 22.5);
  near(ys[1] ?? NaN, 97.5);
});

test('vectorize cover clips to the tile', () => {
  const ps = vectorize(
    grid(16, 8, (x, y) => vertical(x, y) || y === 4),
    16,
    8,
    { ...opts, fit: 'cover' },
  );
  assert.ok(ps.flat().every(([x, y]) => x >= 0 && x <= 120 && y >= 0 && y <= 120));
  // chains() splits the run at the junction with the vertical, so the horizontal line comes back in two
  // polylines; together their points on y = 67.5 reach both tile edges.
  const xs = ps
    .flat()
    .filter(([, y]) => Math.abs(y - 67.5) <= 1e-9)
    .map(([x]) => x);
  near(Math.min(...xs), 0, 1e-6);
  near(Math.max(...xs), 120, 1e-6);
});

test('vectorize contain is the default', () => {
  const m = grid(16, 8, (x, y) => vertical(x, y) || y === 4);
  assert.deepEqual(vectorize(m, 16, 8, { ...opts, fit: 'contain' }), vectorize(m, 16, 8, opts));
});

test('vectorize source hygiene', () => {
  const src = readFileSync(join(import.meta.dirname, 'vectorize.ts'), 'utf8');
  for (const word of ['node:', 'document', 'canvas']) assert.ok(!src.includes(word), word);
});
