import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  curvePathData,
  curveScore,
  fieldGradient,
  fitCurves,
  maxError,
  refine,
  sampleField,
  smoothChain,
  type Cubic,
  type Field,
} from './curvefit.ts';
import { mulberry32, type Pt } from './patterns/util.ts';

const circle = (r: number, n: number, cx = 0, cy = 0): Pt[] => {
  const pts = Array.from({ length: n }, (_, i): Pt => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
  return [...pts, pts[0]!];
};

test('a closed circle fits in a few cubics and stays closed', () => {
  const poly = circle(20, 64);
  const c = fitCurves(poly, 0.5);
  assert.ok(c.length <= 8, `${c.length} cubics`);
  assert.ok(maxError(poly, c) <= 0.5);
  assert.deepEqual(c[c.length - 1]![3], c[0]![0]);
});

test('a square keeps its 4 corners sharp', () => {
  const corners: Pt[] = [
    [0, 0],
    [40, 0],
    [40, 40],
    [0, 40],
  ];
  const poly: Pt[] = [];
  for (let s = 0; s < 4; s++) {
    const a = corners[s]!;
    const b = corners[(s + 1) % 4]!;
    for (let i = 0; i < 10; i++) poly.push([a[0] + ((b[0] - a[0]) * i) / 10, a[1] + ((b[1] - a[1]) * i) / 10]);
  }
  poly.push(poly[0]!);
  const c = fitCurves(poly, 0.5);
  assert.ok(maxError(poly, c) <= 0.5);
  for (const k of corners)
    assert.ok(
      c.some((q) => Math.hypot(q[3][0] - k[0], q[3][1] - k[1]) < 1e-6),
      `corner ${k}`,
    );
});

test('a straight line is one cubic', () => {
  const poly = Array.from({ length: 20 }, (_, i): Pt => [i * 2, i]);
  const c = fitCurves(poly, 0.5);
  assert.equal(c.length, 1);
  assert.ok(maxError(poly, c) < 1e-6);
});

test('noisy sine arcs: error within tolerance, far fewer cubics than points', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rnd = mulberry32(seed);
    const poly = Array.from({ length: 60 }, (_, i): Pt => [i, 10 * Math.sin((i * Math.PI) / 60) + 0.3 * (2 * rnd() - 1)]);
    const c = fitCurves(poly, 1);
    assert.ok(maxError(poly, c) <= 1, `seed ${seed}`);
    assert.ok(c.length < poly.length / 4, `seed ${seed}: ${c.length}`);
  }
});

test('degenerate inputs', () => {
  assert.deepEqual(fitCurves([], 1), []);
  assert.deepEqual(fitCurves([[1, 2]], 1), []);
  const c = fitCurves(
    [
      [1, 2],
      [7, 10],
    ],
    1,
  );
  assert.equal(c.length, 1);
  assert.deepEqual(c[0]![0], [1, 2]);
  assert.deepEqual(c[0]![3], [7, 10]);
});

test('curvePathData: relative c, Z for a closed chain, no newline', () => {
  const a: Cubic = [
    [0, 0],
    [10, 0],
    [20, 10],
    [30, 10.25],
  ];
  assert.equal(curvePathData([[a]], 1), 'M0 0c10 0 20 10 30 10.3');
  const b: Cubic = [
    [5, 5],
    [2, 5],
    [2, 1],
    [5, 0],
  ];
  assert.equal(curvePathData([[b]], 1), 'M5 5c-3 0-3-4 0-5');
  const d = curvePathData([fitCurves(circle(20, 64), 0.5)], 1);
  assert.ok(d.endsWith('Z') && !d.includes('\n'), d);
});

test('curvePathData: a joint at a non-round point stays in one sub-path', () => {
  const d = curvePathData([fitCurves(circle(20, 64, 0.123, 0.456), 0.5)], 1);
  assert.equal(d.match(/M/g)?.length, 1, d);
});

test('sampleField and fieldGradient', () => {
  const f: Field = { width: 2, height: 2, data: Float32Array.from([1, 2, 3, 5]) };
  assert.equal(sampleField(f, 0, 0), 1);
  assert.equal(sampleField(f, 1, 0), 2);
  assert.equal(sampleField(f, 0, 1), 3);
  assert.equal(sampleField(f, 1, 1), 5);
  assert.equal(sampleField(f, 0.5, 0.5), 11 / 4);
  const ramp: Field = { width: 10, height: 10, data: Float32Array.from({ length: 100 }, (_, i) => 0.5 * (i % 10)) };
  const [gx, gy] = fieldGradient(ramp, 4.3, 5.2);
  assert.ok(Math.abs(gx - 0.5) < 1e-6 && Math.abs(gy) < 1e-6);
});

const ring: Field = {
  width: 64,
  height: 64,
  data: Float32Array.from({ length: 64 * 64 }, (_, i) => Math.exp(-((Math.hypot((i % 64) - 32, Math.floor(i / 64) - 32) - 20) ** 2) / 8)),
};
const start = fitCurves(circle(17, 64, 32, 32), 0.5);
const opts = { steps: 60, rate: 10, smooth: 0.0001 };

test('refine pulls a curve onto a ring ridge', () => {
  // The ridge lies 3 units out and the handles of this 2 cubic circle must move about 4: lift the default drift cap
  // (2.5) to the 60 units this test already bounds the drift by.
  const out = refine(start, ring, { ...opts, maxDrift: 60 });
  assert.ok(curveScore(out, ring) > curveScore(start, ring));
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * out.length;
    const c = out[Math.floor(t)]!;
    const u = t - Math.floor(t);
    const s = 1 - u;
    const x = s * s * s * c[0][0] + 3 * s * s * u * c[1][0] + 3 * s * u * u * c[2][0] + u * u * u * c[3][0];
    const y = s * s * s * c[0][1] + 3 * s * s * u * c[1][1] + 3 * s * u * u * c[2][1] + u * u * u * c[3][1];
    sum += Math.abs(Math.hypot(x - 32, y - 32) - 20);
  }
  assert.ok(sum / 64 < 1, `mean distance ${sum / 64}`);
  out.forEach((c, k) => c.forEach((p, j) => assert.ok(Math.hypot(p[0] - start[k]![j]![0], p[1] - start[k]![j]![1]) <= 60)));
  assert.deepEqual(refine(start, ring, { ...opts, steps: 0 }), start);
});

test('refine is deterministic and finite', () => {
  assert.deepEqual(refine(start, ring, opts), refine(start, ring, opts));
  for (const rate of [0.1, 1, 10]) {
    for (const c of refine(start, ring, { ...opts, rate })) for (const p of c) assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }
});

test('smoothChain: open ends stay, closed stays closed, sigma 0 copies', () => {
  const open: Pt[] = Array.from({ length: 30 }, (_, i): Pt => [i, (i % 3) - 1]);
  const o = smoothChain(open, 1.5);
  assert.deepEqual(o[0], open[0]);
  assert.deepEqual(o[o.length - 1], open[open.length - 1]);
  const c = smoothChain(circle(20, 64), 1);
  assert.deepEqual(c[c.length - 1], c[0]);
  const copy = smoothChain(open, 0);
  assert.deepEqual(copy, open);
  assert.notEqual(copy, open);
});

test('smoothChain removes a pixel staircase and keeps a circle', () => {
  // 40 stairs along a 45 degree diagonal; the ideal line runs through the step midpoints: y = x - 0.5.
  const stairs: Pt[] = [];
  for (let k = 0; k < 40; k++) stairs.push([k, k], [k + 1, k]);
  const dist = (p: Pt) => Math.abs(p[0] - p[1] - 0.5) / Math.SQRT2;
  const inner = (ps: Pt[]) => Math.max(...ps.slice(1, -1).map(dist)); // the two ends are pinned by design
  const before = inner(stairs);
  const sm = smoothChain(stairs, 1.5);
  const after = inner(sm);
  console.log(`staircase max distance: before ${before.toFixed(3)}, after ${after.toFixed(3)} (ends ${dist(sm[0]!).toFixed(3)})`);
  assert.ok(after < 0.25, `${after}`);
  for (const r of [circle(20, 64), circle(20, 126)]) {
    const s = smoothChain(r, 1).slice(0, -1);
    const mean = s.reduce((a, p) => a + Math.hypot(p[0], p[1]), 0) / s.length;
    assert.ok(mean > 19.6, `${mean}`);
  }
});

const sampleCubics = (cs: readonly Cubic[]) =>
  cs.flatMap((c) =>
    Array.from({ length: 17 }, (_, i): Pt => {
      const u = i / 16;
      const s = 1 - u;
      const b = [s * s * s, 3 * s * s * u, 3 * s * u * u, u * u * u];
      return [b.reduce((a, w, j) => a + w * c[j]![0], 0), b.reduce((a, w, j) => a + w * c[j]![1], 0)];
    }),
  );

test('refine pins the ends of an open arc and caps the drift', () => {
  const half = circle(17, 64, 32, 32).slice(0, 33);
  const arc = fitCurves(half, 0.5);
  const out = refine(arc, ring, opts);
  assert.deepEqual(out[0]![0], arc[0]![0]);
  assert.deepEqual(out[out.length - 1]![3], arc[arc.length - 1]![3]);
  out.forEach((c, k) =>
    c.forEach((p, j) => assert.ok(Math.hypot(p[0] - arc[k]![j]![0], p[1] - arc[k]![j]![1]) <= 2.5 + 1e-9, `${k} ${j}`)),
  );
});

test('refine: a curve moves the same alone or with 50 other curves', () => {
  const one = fitCurves(circle(17, 64, 32, 32).slice(0, 17), 0.5).slice(0, 1);
  const others: Cubic[] = Array.from({ length: 50 }, (_, k): Cubic => [
    [1 + k * 0.1, 2],
    [1.2 + k * 0.1, 2.1],
    [1.4 + k * 0.1, 2.1],
    [1.6 + k * 0.1, 2],
  ]);
  const alone = refine(one, ring, opts)[0]!;
  const together = refine([...one, ...others], ring, opts)[0]!;
  alone.forEach((p, j) => assert.ok(Math.hypot(p[0] - together[j]![0], p[1] - together[j]![1]) < 1e-9, `${j}`));
  assert.notDeepEqual(alone, one[0]);
});

test('refine: a short stroke on a straight ridge does not hook into a crossing ridge', () => {
  // A ridge along y = 32 and a crossing ridge along x = 36, one px past the end of the stroke.
  const cross: Field = {
    width: 64,
    height: 64,
    data: Float32Array.from({ length: 64 * 64 }, (_, i) =>
      Math.max(Math.exp(-((Math.floor(i / 64) - 32) ** 2) / 8), Math.exp(-(((i % 64) - 36) ** 2) / 8)),
    ),
  };
  const stroke = fitCurves(
    [
      [29, 32],
      [31, 32],
      [33, 32],
      [35, 32],
    ],
    0.5,
  );
  const out = refine(stroke, cross, opts);
  for (const p of sampleCubics(out)) assert.ok(Math.abs(p[1] - 32) <= 0.3 && p[0] >= 29 - 0.3 && p[0] <= 35 + 0.3, `${p}`);
});

test('module hygiene', () => {
  const src = readFileSync(join(import.meta.dirname, 'curvefit.ts'), 'utf8');
  assert.ok(!src.includes('node:') && !src.includes('Math.random'));
});
