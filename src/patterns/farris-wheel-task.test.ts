import assert from 'node:assert/strict';
import { test } from 'node:test';
import { base64, padWrap, unpad, wheelTilePixels } from './farris-wheel-task.ts';
import { edgeSeam } from './farris-wheel.ts';

const COLORS = ['#112233', '#445566', '#778899', '#aabbcc', '#ddeeff'];

test('wheelTilePixels: an opaque n x n tile that repeats without a seam', () => {
  const px = wheelTilePixels({ group: 'p4m', seed: 5, waves: 6, detail: 4, colors: COLORS, n: 32 });
  assert.equal(px.length, 32 * 32 * 4);
  for (let k = 3; k < px.length; k += 4) assert.equal(px[k], 255);
  assert.ok(edgeSeam(px, 32) < 1.5);
});

test('base64 matches Buffer, past one chunk', () => {
  const bytes = new Uint8Array(70000).map((_, i) => (i * 31) & 255);
  assert.equal(base64(bytes), Buffer.from(bytes).toString('base64'));
});

test('padWrap: the border repeats the opposite edges and unpad gives the tile back', () => {
  const n = 4;
  const px = new Uint8ClampedArray(n * n * 4).map((_, i) => i % 251);
  const padded = padWrap(px, n, 1);
  const m = n + 2;
  const at = (a: Uint8ClampedArray, w: number, x: number, y: number) => [...a.subarray((y * w + x) * 4, (y * w + x) * 4 + 4)];
  assert.deepEqual(at(padded, m, 0, 0), at(px, n, n - 1, n - 1)); // top left corner = bottom right pixel
  assert.deepEqual(at(padded, m, m - 1, 2), at(px, n, 0, 1)); // right border = left column
  assert.deepEqual(at(padded, m, 2, m - 1), at(px, n, 1, 0)); // bottom border = top row
  assert.deepEqual([...unpad(padded, n, 1)], [...px]);
});
