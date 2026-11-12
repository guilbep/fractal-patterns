import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLES, sampleImage } from './samples.ts';
import { edges, toGray } from './trace.ts';
import { vectorize } from './vectorize.ts';

const N = 128;

test('each sample is an opaque grayscale square with contrast, mostly light, deterministic', () => {
  for (const id of SAMPLES) {
    const { data, width, height } = sampleImage(id, N);
    assert.equal(width, N);
    assert.equal(height, N);
    assert.equal(data.length, N * N * 4);
    let min = 255;
    let max = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      assert.equal(data[i + 3], 255, id);
      assert.ok(data[i] === data[i + 1] && data[i] === data[i + 2], id);
      min = Math.min(min, data[i]!);
      max = Math.max(max, data[i]!);
      sum += data[i]!;
    }
    assert.ok(max - min >= 80, `${id} contrast ${max - min}`);
    assert.ok(sum / (N * N) > 150, `${id} mean ${sum / (N * N)}`);
    assert.deepEqual(sampleImage(id, N).data, data, id);
  }
});

test('each sample is seamless: the wrap-around step is no rougher than an interior step', () => {
  for (const id of SAMPLES) {
    const { data } = sampleImage(id, N);
    const px = (x: number, y: number): number => data[(y * N + x) * 4]!;
    const col = (a: number, b: number): number => {
      let s = 0;
      for (let y = 0; y < N; y++) s += Math.abs(px(a, y) - px(b, y));
      return s / N;
    };
    const row = (a: number, b: number): number => {
      let s = 0;
      for (let x = 0; x < N; x++) s += Math.abs(px(x, a) - px(x, b));
      return s / N;
    };
    assert.ok(col(0, N - 1) <= 3 * col(60, 61) + 4, `${id} columns ${col(0, N - 1)} vs ${col(60, 61)}`);
    assert.ok(row(0, N - 1) <= 3 * row(60, 61) + 4, `${id} rows ${row(0, N - 1)} vs ${row(60, 61)}`);
  }
});

test('size is clamped to 64..512', () => {
  const small = sampleImage('bricks', 10);
  assert.equal(small.width, 64);
  assert.equal(small.height, 64);
  const big = sampleImage('bricks', 9999);
  assert.equal(big.width, 512);
  assert.equal(big.height, 512);
});

test('the samples differ from each other', () => {
  const imgs = SAMPLES.map((id) => sampleImage(id, N).data);
  for (let a = 0; a < imgs.length; a++) {
    for (let b = a + 1; b < imgs.length; b++) {
      let diff = 0;
      for (let i = 0; i < imgs[a]!.length; i += 4) if (Math.abs(imgs[a]![i]! - imgs[b]![i]!) > 30) diff++;
      assert.ok(diff > 0.05 * N * N, `${SAMPLES[a]} vs ${SAMPLES[b]}: ${diff}`);
    }
  }
});

test('the tracing pipeline finds edges and lines in each sample', () => {
  for (const id of SAMPLES) {
    const { data, width, height } = sampleImage(id, 192);
    const map = edges(toGray(data, width, height), 'canny', 0.3);
    const count = map.reduce((s, v) => s + (v ? 1 : 0), 0);
    assert.ok(count >= 200, `${id} edge pixels ${count}`);
    const lines = vectorize(map, width, height, { size: 120, tolerance: 1.5, minLength: 8 });
    assert.ok(lines.length >= 5, `${id} lines ${lines.length}`);
    for (const line of lines) for (const [x, y] of line) assert.ok(x >= 0 && x <= 120 && y >= 0 && y <= 120, `${id} point ${x},${y}`);
  }
});

test('samples.ts stays pure', () => {
  const src = readFileSync(join(import.meta.dirname, 'samples.ts'), 'utf8');
  for (const bad of ['node:', 'document', 'Math.random']) assert.ok(!src.includes(bad), bad);
});
