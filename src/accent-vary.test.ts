import { test } from 'node:test';
import assert from 'node:assert/strict';
import { varyAccent, type AccentVary } from './accent-vary.ts';
import type { Poly, Pt } from './patterns/util.ts';

const circle = (cx: number, cy: number, r: number, n = 16): Poly => {
  const p: Poly = Array.from({ length: n }, (_, i): Pt => [
    cx + r * Math.cos((2 * Math.PI * i) / n),
    cy + r * Math.sin((2 * Math.PI * i) / n),
  ]);
  p.push(p[0]!);
  return p;
};
const DOTS: Poly[] = [circle(25, 25, 8), circle(75, 25, 8), circle(25, 75, 8), circle(75, 75, 8)];
const ZERO: AccentVary = { cells: 6, move: 0, scale: 0, drop: 0, turn: 0 };
const area = (p: Poly): number => Math.abs(p.slice(0, -1).reduce((a, [x, y], i) => a + x * p[i + 1]![1] - p[i + 1]![0] * y, 0)) / 2;
const centroid = (p: Poly): Pt => {
  const q = p.slice(0, -1);
  return [q.reduce((a, [x]) => a + x, 0) / q.length, q.reduce((a, [, y]) => a + y, 0) / q.length];
};
test('all zero: 144 translated copies, offsets multiples of 100', () => {
  const r = varyAccent(DOTS, 100, 100, ZERO, 1);
  assert.equal(r.polys.length, 144);
  assert.equal(r.width, 600);
  assert.equal(r.height, 600);
  r.polys.forEach((p, k) => {
    const i = k % 4;
    const t = Math.floor(k / 4);
    const ox = (t % 6) * 100;
    const oy = Math.floor(t / 6) * 100;
    assert.deepEqual(
      p,
      DOTS[i]!.map(([x, y]) => [x + ox, y + oy]),
    );
  });
});

test('drop 50: pinned count for seed 1, deterministic, seed dependent', () => {
  const v = { ...ZERO, drop: 50 };
  const a = varyAccent(DOTS, 100, 100, v, 1);
  assert.ok(a.polys.length >= 50 && a.polys.length <= 94);
  assert.equal(a.polys.length, 71); // measured once for seed 1
  assert.deepEqual(varyAccent(DOTS, 100, 100, v, 1), a);
  assert.notDeepEqual(varyAccent(DOTS, 100, 100, v, 2).polys, a.polys);
});

test('scale 100: every area between 0.6^2 and 1.4^2 of the original', () => {
  const a0 = area(DOTS[0]!);
  const r = varyAccent(DOTS, 100, 100, { ...ZERO, scale: 100 }, 1);
  assert.equal(r.polys.length, 144);
  let changed = false;
  for (const p of r.polys) {
    const k = area(p) / a0;
    assert.ok(k >= 0.36 - 1e-6 && k <= 1.96 + 1e-6, String(k));
    if (Math.abs(k - 1) > 1e-3) changed = true;
  }
  assert.ok(changed);
});

test('move: centroid within move/100 * diameter of the unmoved copy, all points inside the super tile', () => {
  const move = 100;
  const r = varyAccent(DOTS, 100, 100, { ...ZERO, move }, 3);
  let moved = false;
  r.polys.forEach((p, k) => {
    const i = k % 4;
    const t = Math.floor(k / 4);
    const [sx, sy] = centroid(DOTS[i]!);
    const [cx, cy] = centroid(p);
    const d = Math.hypot(cx - sx - (t % 6) * 100, cy - sy - Math.floor(t / 6) * 100);
    assert.ok(d <= (move / 100) * 2 * 8 + 1e-9, String(d));
    if (d > 1) moved = true;
    for (const [x, y] of p) assert.ok(x >= 0 && x < 600 && y >= 0 && y < 600);
  });
  assert.ok(moved);
});

test('move near the edge is clamped inside the super tile', () => {
  const edge = [circle(4, 4, 4), circle(96, 96, 3.9)];
  const r = varyAccent(edge, 100, 100, { cells: 6, move: 100, scale: 100, drop: 0, turn: 100 }, 5);
  for (const p of r.polys) for (const [x, y] of p) assert.ok(x >= 0 && x < 600 && y >= 0 && y < 600, `${x},${y}`);
});

test('turn 100 on a square: some copy is rotated', () => {
  const sq: Poly = [
    [40, 40],
    [60, 40],
    [60, 60],
    [40, 60],
    [40, 40],
  ];
  const r = varyAccent([sq], 100, 100, { ...ZERO, turn: 100 }, 1);
  const rotated = r.polys.some((p, k) => {
    const ox = (k % 6) * 100;
    const oy = Math.floor(k / 6) * 100;
    return p.some(([x, y], j) => Math.hypot(x - sq[j]![0] - ox, y - sq[j]![1] - oy) > 1);
  });
  assert.ok(rotated);
});

test('cells 1: output is the input', () => {
  const r = varyAccent(DOTS, 100, 100, { cells: 1, move: 50, scale: 50, drop: 30, turn: 50 }, 1);
  assert.equal(r.polys, DOTS);
  assert.equal(r.width, 100);
  assert.equal(r.height, 100);
  assert.deepEqual(varyAccent(DOTS, 100, 100, { ...ZERO, cells: 1 }, 1).polys, DOTS);
});

test('closed stays closed', () => {
  const r = varyAccent(DOTS, 100, 80, { cells: 6, move: 35, scale: 50, drop: 28, turn: 40 }, 9);
  assert.equal(r.height, 480);
  for (const p of r.polys) assert.deepEqual(p[0], p.at(-1));
});
