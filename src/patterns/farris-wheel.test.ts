import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edgeSeam, hexToRgb, wheelPixels } from './farris-wheel.ts';

const COLORS = ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffffff'];

function one(re: number, im: number) {
  return { n: 1, re: Float64Array.of(re), im: Float64Array.of(im) };
}

function periodic(n: number) {
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const v = j / n;
      re[j * n + i] = Math.cos(2 * Math.PI * u) + 0.3 * Math.sin(2 * Math.PI * 3 * v);
      im[j * n + i] = Math.sin(2 * Math.PI * u) * Math.cos(2 * Math.PI * v);
    }
  }
  return { n, re, im };
}

test('hexToRgb reads #rrggbb and #rgb', () => {
  assert.deepEqual(hexToRgb('#ff8000'), [255, 128, 0]);
  assert.deepEqual(hexToRgb('#f80'), [255, 136, 0]);
});

test('angle picks the palette colour, |f| at q95 shades by 1.15', () => {
  assert.deepEqual([...wheelPixels(one(-1, 0), COLORS)], [0, 0, 0, 255]);
  assert.deepEqual([...wheelPixels(one(1, 0), COLORS)], [0, 147, 147, 255]);
});

test('periodic input gives a seamless tile', () => {
  const r = edgeSeam(wheelPixels(periodic(64), COLORS), 64);
  assert.ok(r > 0.5 && r < 2, `edgeSeam ${r}`);
});

test('a hard seam in column 0 is detected', () => {
  const n = 64;
  const px = wheelPixels(periodic(n), COLORS);
  for (let j = 0; j < n; j++) px.set([255, 0, 255], j * n * 4);
  const r = edgeSeam(px, n);
  assert.ok(r > 3, `edgeSeam ${r}`);
});

test('output is n*n*4 bytes, opaque', () => {
  const n = 64;
  const px = wheelPixels(periodic(n), COLORS);
  assert.equal(px.length, n * n * 4);
  for (let k = 3; k < px.length; k += 4) assert.equal(px[k], 255);
});
