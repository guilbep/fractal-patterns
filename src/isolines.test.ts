import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { chooseLevels, isolines, snapToEdges, traceIsolines, type IsoOptions } from './isolines.ts';
import type { Pt } from './patterns/util.ts';
import type { Gray } from './trace.ts';

const image = (w: number, h: number, f: (x: number, y: number) => number): Gray => {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x + 0.5, y + 0.5);
  return { data, width: w, height: h };
};
const r = (x: number, y: number) => Math.hypot(x - 32, y - 32);
const softDisc = image(64, 64, (x, y) => 255 * Math.min(1, Math.max(0, (24 - r(x, y)) / 4)));
const sharpDisc = image(64, 64, (x, y) => (r(x, y) < 20 ? 255 : 0));
const closed = (l: Pt[]) => l.length > 2 && l[0]![0] === l.at(-1)![0] && l[0]![1] === l.at(-1)![1];
const area = (l: Pt[]) => Math.abs(l.slice(1).reduce((s, [x, y], i) => s + l[i]![0] * y - x * l[i]![1], 0)) / 2;

test('chooseLevels: two flat halves give one level between them', () => {
  const levels = chooseLevels(
    image(32, 32, (x) => (x < 16 ? 50 : 200)),
    1,
  );
  assert.equal(levels.length, 1);
  assert.ok(levels[0]! > 100 && levels[0]! < 150, String(levels));
});

test('chooseLevels: a flat image gives no level', () => {
  assert.deepEqual(
    chooseLevels(
      image(16, 16, () => 90),
      4,
    ),
    [],
  );
});

test('chooseLevels: four bands give three ascending levels, one between each pair', () => {
  const bands = [20, 90, 160, 230];
  const levels = chooseLevels(
    image(64, 16, (x) => bands[Math.floor(x / 16)]!),
    3,
  );
  assert.equal(levels.length, 3);
  for (let i = 0; i < 3; i++) assert.ok(levels[i]! > bands[i]! && levels[i]! < bands[i + 1]!, String(levels));
  const ramp = chooseLevels(
    image(64, 64, (x, y) => (x + y) * 2),
    6,
  );
  assert.deepEqual(
    ramp,
    [...ramp].sort((a, b) => a - b),
  );
});

test('isolines: soft disc gives one sub-pixel closed loop', () => {
  const lines = isolines(softDisc, 128);
  assert.equal(lines.length, 1);
  const loop = lines[0]!;
  assert.ok(closed(loop));
  for (const [x, y] of loop) assert.ok(r(x, y) >= 21.5 && r(x, y) <= 22.5, `${r(x, y)}`);
  const want = Math.PI * 22 * 22;
  assert.ok(Math.abs(area(loop) - want) / want < 0.03, `${area(loop)}`);
});

test('isolines: a left-to-right ramp gives one open vertical line from border to border', () => {
  const g = image(32, 20, (x) => x * 8);
  const lines = isolines(g, (0.5 * 8 + 31.5 * 8) / 2);
  assert.equal(lines.length, 1);
  const line = lines[0]!;
  assert.ok(!closed(line));
  for (const [x] of line) assert.ok(Math.abs(x - 16) < 1e-6);
  const ys = [line[0]![1], line.at(-1)![1]].sort((a, b) => a - b);
  assert.deepEqual(ys, [0.5, 19.5]);
});

test('snapToEdges: hysteresis keeps the run with a strong vertex and its weak neighbors', () => {
  const mag = Float32Array.from([0, 0, 5, 10, 10, 10, 5, 0, 0, 0]);
  const line: Pt[] = Array.from({ length: 10 }, (_, i) => [i + 0.5, 0.5]);
  assert.deepEqual(snapToEdges([line], mag, 10, 1, 10), [line.slice(2, 7)]);
  assert.deepEqual(snapToEdges([line], mag, 10, 1, 20), []);
  const loop: Pt[] = [
    [0.5, 0.5],
    [5.5, 0.5],
    [4.5, 0.5],
    [0.5, 0.5],
  ];
  assert.deepEqual(snapToEdges([loop], new Float32Array(10).fill(30), 10, 1, 10), [loop]);
});

const opts: IsoOptions = { levels: 4, blur: 1, strength: 0.7, minLength: 4, tolerance: 0, size: 128 };
const s = 128 / 64;

test('traceIsolines: keeps the disc outline and drops the gentle ramp', () => {
  const g = image(64, 64, (x, y) => Math.min(255, (r(x, y) < 20 ? 255 : 0) + (40 * x) / 64));
  const out = traceIsolines(g, opts);
  const back = out.map((l) => l.map(([x, y]): Pt => [x / s, y / s]));
  const bins = new Set<number>();
  for (const l of back)
    for (const [x, y] of l)
      if (Math.abs(r(x, y) - 20) <= 2) bins.add(Math.floor(((Math.atan2(y - 32, x - 32) + Math.PI) * 180) / Math.PI / 5) % 72);
  assert.ok(bins.size >= 0.9 * 72, `${bins.size} of 72 bins`);
  for (const l of back)
    assert.ok(
      l.some(([x, y]) => Math.abs(r(x, y) - 20) <= 6),
      'a piece away from the circle',
    );
});

test('traceIsolines: near-identical curves of several levels collapse', () => {
  const out = traceIsolines(sharpDisc, opts);
  assert.ok(out.length >= 1 && out.length <= 2, `${out.length} curves`);
});

test('traceIsolines: deterministic and inside the tile', () => {
  const a = traceIsolines(softDisc, opts);
  assert.deepEqual(a, traceIsolines(softDisc, opts));
  for (const l of a) for (const [x, y] of l) assert.ok(x >= 0 && x <= 128 && y >= 0 && y <= 128);
});

test('source hygiene: no node imports, no Math.random', () => {
  const src = readFileSync(new URL('./isolines.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:'));
  assert.ok(!src.includes('Math.random'));
});
