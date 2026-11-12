import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DETECTORS, edges, gaussianBlur, gradient, toGray, type Gray } from './trace.ts';

const KERNELS = ['sobel', 'prewitt', 'roberts', 'laplacian'] as const;

function rgba(width: number, height: number, f: (x: number, y: number) => number): number[] {
  const out: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out.push(f(x, y), f(x, y), f(x, y), 255);
  return out;
}

const image = (width: number, height: number, f: (x: number, y: number) => number): Gray =>
  toGray(rgba(width, height, f), width, height);

const flat = image(16, 8, () => 128);
const step = image(16, 8, (x) => (x < 8 ? 0 : 255));
const inSquare = (v: number) => v >= 10 && v <= 21;
const square = image(32, 32, (x, y) => (inSquare(x) && inSquare(y) ? 255 : 0));

const row = (m: ArrayLike<number>, width: number, y: number) => Array.from({ length: width }, (_, x) => m[y * width + x] ?? NaN);

test('toGray vectors', () => {
  assert.ok(Math.abs((toGray([255, 0, 0, 255], 1, 1).data[0] ?? NaN) - 76.245) < 1e-3);
  assert.equal(toGray([0, 0, 0, 0], 1, 1).data[0], 255);
  assert.equal(toGray([0, 0, 0, 255], 1, 1).data[0], 0);
  assert.throws(() => toGray([0, 0, 0], 1, 1));
});

test('flat image has no gradient and no edges', () => {
  for (const d of KERNELS) assert.ok(gradient(flat, d).every((v) => v === 0), d);
  for (const d of DETECTORS) assert.ok(edges(flat, d, 0.1).every((v) => v === 0), d);
});

test('vertical step: sobel, prewitt, laplacian on row 4', () => {
  const expect = { sobel: 1020, prewitt: 765 } as const;
  for (const d of ['sobel', 'prewitt'] as const) {
    const r = row(gradient(step, d), 16, 4);
    assert.equal(r[7], expect[d], d);
    assert.equal(r[8], expect[d], d);
    for (const x of [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15]) assert.equal(r[x], 0, `${d} x=${x}`);
  }
  const lap = row(gradient(step, 'laplacian'), 16, 4);
  lap.forEach((v, x) => assert.equal(v, x === 7 || x === 8 ? 255 : 0, `laplacian x=${x}`));
});

test('vertical step: roberts', () => {
  const m = gradient(step, 'roberts');
  assert.ok(Math.abs(Math.max(...m) - 255 * Math.SQRT2) < 1e-2);
  const r = row(m, 16, 4);
  for (const x of [0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14, 15]) assert.equal(r[x], 0, `x=${x}`);
});

test('vertical step: canny gives a thin line', () => {
  const e = edges(step, 'canny', 0.3);
  for (let y = 1; y <= 6; y++) {
    const xs = row(e, 16, y).flatMap((v, x) => (v === 1 ? [x] : []));
    assert.ok(xs.length >= 1 && xs.length <= 2, `y=${y}: ${xs}`);
    assert.ok(xs.every((x) => x === 7 || x === 8), `y=${y}: ${xs}`);
  }
});

test('square: every detector traces the outline', () => {
  // Chebyshev distance from (x, y) to one side of the outline (a segment of the 10..21 block border).
  const toSide = (x: number, y: number, side: 'top' | 'bottom' | 'left' | 'right') => {
    const along = side === 'top' || side === 'bottom' ? x : y;
    const across = side === 'top' || side === 'bottom' ? y : x;
    const line = side === 'top' || side === 'left' ? 10 : 21;
    return Math.max(Math.max(0, 10 - along, along - 21), Math.abs(across - line));
  };
  const sides = ['top', 'bottom', 'left', 'right'] as const;
  for (const d of DETECTORS) {
    const e = edges(square, d, 0.3);
    const pts: [number, number][] = [];
    e.forEach((v, i) => v === 1 && pts.push([i % 32, Math.floor(i / 32)]));
    assert.ok(pts.length > 0, d);
    for (const [x, y] of pts) assert.ok(Math.min(...sides.map((s) => toSide(x, y, s))) <= 2, `${d} (${x}, ${y})`);
    for (const s of sides) assert.ok(pts.filter(([x, y]) => toSide(x, y, s) <= 2).length >= 6, `${d} ${s}`);
  }
});

test('gaussianBlur', () => {
  assert.ok(gaussianBlur(flat, 1.4).data.every((v) => Math.abs(v - 128) < 1e-3));
  assert.deepEqual(gaussianBlur(step, 0).data, step.data);
  const b = gaussianBlur(step, 1.4);
  assert.ok(b.data.every((v) => v >= 0 && v <= 255));
  const v = b.data[4 * 16 + 7] ?? NaN;
  assert.ok(v > 0 && v < 255, String(v));
});

test('trace.ts uses no Node-only or DOM APIs', () => {
  const src = readFileSync(join(import.meta.dirname, 'trace.ts'), 'utf8');
  for (const word of ['node:', 'document', 'canvas']) assert.ok(!src.includes(word), word);
});
