import assert from 'node:assert/strict';
import { test } from 'node:test';
import { base64, wheelTilePixels } from './farris-wheel-task.ts';
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
