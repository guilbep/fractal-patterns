import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { bandsDocument, bandsSvg } from './farris-bands.ts';
import { mulberry32 } from './util.ts';

type Grid = { n: number; re: Float64Array; im: Float64Array };
const COLORS = ['#000', '#333', '#666', '#999', '#ccc'] as const;
const TAU = 2 * Math.PI;

const gridOf = (n: number, f: (u: number, v: number) => number): Grid => {
  const re = new Float64Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) re[j * n + i] = f((i + 0.5) / n, (j + 0.5) / n);
  return { n, re, im: new Float64Array(n * n) };
};
const smooth = (n = 64): Grid => gridOf(n, (u, v) => Math.sin(TAU * u) * Math.cos(TAU * 2 * v) + 0.5 * Math.cos(TAU * (u + v)));
const waves = (seed: number, n = 64): Grid => {
  const rnd = mulberry32(seed);
  const w = Array.from({ length: 6 }, () => ({
    a: Math.floor(rnd() * 7) - 3,
    b: Math.floor(rnd() * 7) - 3,
    c: rnd() * 2 - 1,
    ph: rnd() * TAU,
  }));
  return gridOf(n, (u, v) => w.reduce((s, { a, b, c, ph }) => s + c * Math.cos(TAU * (a * u + b * v) + ph), 0));
};
const paths = (body: string): string[] => [...body.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]!);

// Loops of a path written as "M x y l dx dy ... Z".
const loopsOf = (d: string): [number, number][][] =>
  d
    .split('Z')
    .filter((s) => s)
    .map((sub) => {
      const [abs = '', rel = ''] = sub.slice(1).split('l');
      const num = (s: string): number[] => (s.match(/-?\d+/g) ?? []).map(Number);
      let [x = 0, y = 0] = num(abs);
      const pts: [number, number][] = [[x, y]];
      const r = num(rel);
      for (let i = 0; i < r.length; i += 2) pts.push([(x += r[i]!), (y += r[i + 1]!)]);
      return pts;
    });
const inside = (loops: [number, number][][], x: number, y: number): boolean => {
  let c = false;
  for (const p of loops) {
    for (let i = 0, k = p.length - 1; i < p.length; k = i++) {
      const [xi, yi] = p[i]!;
      const [xk, yk] = p[k]!;
      if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) c = !c;
    }
  }
  return c;
};
// Bilinear value of the periodic grid at tile coords (u, v) in [0, 1).
const sample = ({ n, re }: Grid, u: number, v: number): number => {
  const gx = u * n - 0.5;
  const gy = v * n - 0.5;
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gy);
  const fx = gx - i0;
  const fy = gy - j0;
  const at = (i: number, j: number): number => re[(((j % n) + n) % n) * n + (((i % n) + n) % n)]!;
  return (1 - fx) * (1 - fy) * at(i0, j0) + fx * (1 - fy) * at(i0 + 1, j0) + (1 - fx) * fy * at(i0, j0 + 1) + fx * fy * at(i0 + 1, j0 + 1);
};

test('balanced levels give equal colour areas', () => {
  for (const g of [smooth(), waves(3)]) {
    const { areas } = bandsSvg(g, { colors: COLORS, size: 160, balance: true });
    assert.equal(areas.length, 5);
    assert.ok(Math.abs(areas.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    for (const a of areas) assert.ok(Math.abs(a - 0.2) <= 0.02, `area ${a}`);
  }
});

test('unbalanced levels are evenly spaced', () => {
  const { levels } = bandsSvg(waves(5), { colors: COLORS, size: 160, balance: false });
  for (let k = 1; k < 3; k++) assert.ok(Math.abs(levels[k + 1]! - levels[k]! - (levels[1]! - levels[0]!)) < 1e-9);
  assert.ok(levels[0]! < levels[3]!);
});

test('one rect, four closed integer paths, no NaN', () => {
  for (const g of [smooth(), waves(1), waves(2)]) {
    const { body } = bandsSvg(g, { colors: COLORS, size: 160, balance: true });
    assert.equal(body.match(/<rect /g)?.length, 1);
    const ds = paths(body);
    assert.equal(ds.length, 4);
    for (const d of ds) {
      assert.match(d, /^(M-?\d+[ -]?\d+l(-?\d+[ -]?)*Z)+$/);
      assert.ok(d.length > 0);
    }
    assert.ok(!/NaN|Infinity/.test(body));
  }
});

test('the bands read from the paths match the field', () => {
  const size = 160;
  for (const [g, balance] of [
    [smooth(), true],
    [waves(4), false],
    [waves(9), true],
  ] as const) {
    const { body, levels } = bandsSvg(g, { colors: COLORS, size, balance });
    const loops = paths(body).map(loopsOf);
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of g.re) [lo, hi] = [Math.min(lo, v), Math.max(hi, v)];
    const margin = 0.05 * (hi - lo);
    const rnd = mulberry32(42);
    let checked = 0;
    for (let t = 0; t < 400; t++) {
      const u = rnd();
      const v = rnd();
      const f = sample(g, u, v);
      if (levels.some((q) => Math.abs(f - q) < margin)) continue;
      checked++;
      const want = levels.filter((q) => f >= q).length;
      let got = 0;
      loops.forEach((l, k) => {
        if (inside(l, u * size, v * size)) got = k + 1;
      });
      assert.equal(got, want, `point (${u}, ${v}) f=${f}`);
    }
    assert.ok(checked > 100, `checked ${checked}`);
  }
});

test('random tiles fit the per-tile cap', () => {
  const gz: number[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    const doc = bandsDocument(bandsSvg(waves(seed), { colors: COLORS, size: 160, balance: true }).body, 160);
    assert.ok(doc.length <= 20000, `seed ${seed}: ${doc.length} chars`);
    gz.push(gzipSync(doc, { level: 9 }).length);
  }
  gz.sort((a, b) => a - b);
  console.log(`gzip bytes min ${gz[0]} median ${(gz[4]! + gz[5]!) / 2} max ${gz[9]}`);
});

test('simplification shortens the output', () => {
  const g = waves(6);
  const at = (epsilon: number): number => bandsSvg(g, { colors: COLORS, size: 160, balance: true, epsilon }).body.length;
  assert.ok(at(0.4) < at(0), `${at(0.4)} vs ${at(0)}`);
});
