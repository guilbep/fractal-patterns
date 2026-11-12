import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DETECTOR_LABELS, DETECTORS, edges, gaussianBlur, gradient, thin, toGray, xdogMask, type Gray } from './trace.ts';

const KERNELS = ['sobel', 'prewitt', 'roberts', 'laplacian'] as const;

function rgba(width: number, height: number, f: (x: number, y: number) => number): number[] {
  const out: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out.push(f(x, y), f(x, y), f(x, y), 255);
  return out;
}

const image = (width: number, height: number, f: (x: number, y: number) => number): Gray => toGray(rgba(width, height, f), width, height);

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
  for (const d of KERNELS)
    assert.ok(
      gradient(flat, d).every((v) => v === 0),
      d,
    );
  for (const d of DETECTORS)
    assert.ok(
      edges(flat, d, 0.1).every((v) => v === 0),
      d,
    );
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
    assert.ok(
      xs.every((x) => x === 7 || x === 8),
      `y=${y}: ${xs}`,
    );
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
    // XDoG draws its line on the dark side of an edge by design (deepest dip about 1.5 px out), so it gets 3 px.
    const tol = d === 'xdog' ? 3 : 2;
    for (const [x, y] of pts) assert.ok(Math.min(...sides.map((s) => toSide(x, y, s))) <= tol, `${d} (${x}, ${y})`);
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

test('DETECTORS: new ids appended, old order kept, every id labelled', () => {
  assert.deepEqual(DETECTORS.slice(0, 5), ['sobel', 'prewitt', 'roberts', 'laplacian', 'canny']);
  assert.deepEqual(DETECTORS.slice(-2), ['scharr', 'xdog']);
  for (const d of DETECTORS) assert.ok(DETECTOR_LABELS[d].length > 0, d);
});

const R = 20;
const disc = image(64, 64, (x, y) => (Math.hypot(x - 32, y - 32) <= R ? 255 : 0));
const toCircle = (i: number) => Math.abs(Math.hypot((i % 64) - 32, Math.floor(i / 64) - 32) - R);

const count = (m: Uint8Array) => m.reduce((s, v) => s + v, 0);

test('disc: scharr and xdog trace the circle, fewer pixels as the threshold rises', () => {
  for (const d of ['scharr', 'xdog'] as const) {
    let prev = Infinity;
    for (const t of [0.2, 0.5, 0.8]) {
      const e = edges(disc, d, t);
      const on = [...e.keys()].filter((i) => e[i] === 1);
      assert.ok(on.length > 0, `${d} ${t}`);
      assert.ok(
        on.some((i) => toCircle(i) <= 2.5),
        `${d} ${t}`,
      );
      for (const i of on) assert.ok(toCircle(i) <= 4, `${d} ${t} pixel ${i}`);
      // XDoG: thinning can make a wider band's skeleton shorter, so the count property is checked on the unthinned mask.
      const n = d === 'xdog' ? count(xdogMask(disc, t)) : on.length;
      assert.ok(n <= prev, `${d} ${t}: ${n} > ${prev}`);
      prev = n;
    }
  }
});

test('scharr is more rotation-symmetric than sobel on a smooth disc', () => {
  // Measured: on a smooth disc (anti-aliased, blurred sigma 1.5, bilinear sampling) scharr 0.0083 vs sobel 0.0100.
  // On the hard-edged disc Sobel measures better (nearest pixel 0.0947 vs 0.1074, bilinear 0.0278 vs 0.0397):
  // pixel aliasing dominates there, so Scharr only helps on smooth edges.
  const smooth = gaussianBlur(
    image(64, 64, (x, y) => 255 * Math.min(1, Math.max(0, R + 0.5 - Math.hypot(x - 32, y - 32)))),
    1.5,
  );
  const spread = (d: 'sobel' | 'scharr') => {
    const m = gradient(smooth, d);
    const at = (x: number, y: number) => m[y * 64 + x] ?? NaN;
    const v = Array.from({ length: 72 }, (_, k) => {
      const a = (k * 2 * Math.PI) / 72;
      const [sx, sy] = [32 + R * Math.cos(a), 32 + R * Math.sin(a)];
      const [x0, y0] = [Math.floor(sx), Math.floor(sy)];
      const [fx, fy] = [sx - x0, sy - y0];
      return (
        (1 - fx) * (1 - fy) * at(x0, y0) + fx * (1 - fy) * at(x0 + 1, y0) + (1 - fx) * fy * at(x0, y0 + 1) + fx * fy * at(x0 + 1, y0 + 1)
      );
    });
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length) / mean;
  };
  assert.ok(spread('scharr') < spread('sobel'), `${spread('scharr')} vs ${spread('sobel')}`);
});

test('thin: bar to a line, line kept, empty kept, subset of input', () => {
  const [w, h] = [50, 15];
  const bar = new Uint8Array(w * h);
  for (let y = 5; y < 10; y++) for (let x = 5; x < 45; x++) bar[y * w + x] = 1;
  const t = thin(bar, w, h);
  for (let x = 10; x < 40; x++) assert.equal([...Array(h).keys()].filter((y) => t[y * w + x] === 1).length, 1, `x=${x}`);
  t.forEach((v, i) => assert.ok(v === 0 || bar[i] === 1, `pixel ${i}`));
  const line = new Uint8Array(w * h);
  for (let x = 5; x < 45; x++) line[7 * w + x] = 1;
  assert.deepEqual(thin(line, w, h), line);
  assert.ok(thin(new Uint8Array(w * h), w, h).every((v) => v === 0));
});

test('xdog: flat gray has no edge', () => {
  assert.ok(
    edges(
      image(32, 32, () => 128),
      'xdog',
      0.1,
    ).every((v) => v === 0),
  );
});
