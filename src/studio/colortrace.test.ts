import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safePathData } from '../motifgrid.ts';
import { cropToSubject, pathArea, quantize, sampleFlower, traceColors, traceSvg, type Rgba } from './colortrace.ts';
import { motifBounds } from './motifs.ts';

type RGB = readonly [number, number, number];
const RED: RGB = [220, 30, 40];
const GREEN: RGB = [30, 160, 60];
const WHITE: RGB = [255, 255, 255];
const YELLOW: RGB = [250, 210, 30];

const image = (w: number, h: number, f: (x: number, y: number) => RGB | null): Rgba => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = f(x + 0.5, y + 0.5);
      if (c) data.set([...c, 255], 4 * (y * w + x));
    }
  }
  return { width: w, height: h, data };
};
const inDisc = (x: number, y: number, cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) < r;
// Red disc (center 20,20, radius 12) and green square [36, 56) x [30, 50) on white, 64 x 64.
const scene = image(64, 64, (x, y) => (inDisc(x, y, 20, 20, 12) ? RED : x > 36 && x < 56 && y > 30 && y < 50 ? GREEN : WHITE));
const hex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const near = (h: string, c: RGB) => [1, 3, 5].every((i, j) => Math.abs(parseInt(h.slice(i, i + 2), 16) - c[j]!) <= 8);
const opts = { colors: 3, size: 100, smooth: 1, tolerance: 0.5, minArea: 4, curves: false };
const S = 100 / 64;

test('quantize: three flat colors give the three colors, white is the background', () => {
  const q = quantize(scene, 3);
  assert.equal(q.palette.length, 3);
  for (const c of [RED, GREEN, WHITE])
    assert.ok(
      q.palette.some((h) => near(h, c)),
      `${hex(c)} in ${q.palette.join(' ')}`,
    );
  assert.ok(near(q.palette[q.background]!, WHITE));
  const disc = q.index[20 * 64 + 20]!;
  assert.ok(near(q.palette[disc]!, RED));
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) if (inDisc(x + 0.5, y + 0.5, 20, 20, 12)) assert.equal(q.index[y * 64 + x], disc);
});

test('quantize: transparent pixels are background', () => {
  const img = image(32, 32, (x, y) => (inDisc(x, y, 16, 16, 8) ? RED : x < 4 ? null : WHITE));
  const q = quantize(img, 2);
  assert.ok(near(q.palette[q.background]!, WHITE));
  assert.equal(q.index[10 * 32 + 1], q.background);
});

test('quantize: deterministic', () => {
  const a = quantize(scene, 4);
  const b = quantize(scene, 4);
  assert.deepEqual(a.palette, b.palette);
  assert.deepEqual(a.index, b.index);
});

test('traceColors: disc and square, area and corners', (t) => {
  const r = traceColors(scene, opts);
  assert.equal(r.shapes.length, 2);
  assert.ok(near(r.background, WHITE));
  assert.ok(r.shapes[0]!.area >= r.shapes[1]!.area);
  for (const s of r.shapes) {
    assert.equal(safePathData(s.d), s.d);
    assert.ok(s.d.endsWith('Z'));
  }
  const disc = r.shapes.find((s) => near(s.color, RED))!;
  const square = r.shapes.find((s) => near(s.color, GREEN))!;
  const want = Math.PI * (12 * S) ** 2;
  // Red is at the back, so its plate also covers the square underneath: measure the sub-path around the disc.
  const subs = disc.d.split('M').filter(Boolean);
  assert.equal(subs.length, 2);
  const firstX = (sub: string) => Number(sub.split(' ')[0]);
  const got = pathArea('M' + subs.find((sub) => firstX(sub) < 34 * S)!);
  t.diagnostic(`disc area ${got.toFixed(1)} vs ${want.toFixed(1)}`);
  assert.ok(Math.abs(got - want) / want < 0.06, `${got} vs ${want}`);
  const pts = [...square.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
  const corners: [number, number][] = [
    [36, 30],
    [56, 30],
    [56, 50],
    [36, 50],
  ];
  for (const [cx, cy] of corners) {
    const dmin = Math.min(...pts.map(([x, y]) => Math.hypot(x - cx * S, y - cy * S)));
    t.diagnostic(`corner ${cx},${cy}: ${dmin.toFixed(2)}`);
    assert.ok(dmin <= 2.5, `corner ${cx},${cy} at ${dmin}`);
  }
});

test('traceColors: curves', (t) => {
  const poly = traceColors(scene, opts);
  const curved = traceColors(scene, { ...opts, curves: true });
  for (const s of curved.shapes) {
    assert.match(s.d, /[Cc]/);
    assert.doesNotMatch(s.d, /L/);
    assert.equal(safePathData(s.d), s.d);
  }
  const len = (r: typeof poly) => r.shapes.reduce((n, s) => n + s.d.length, 0);
  t.diagnostic(`path chars: polyline ${len(poly)}, curves ${len(curved)}`);
});

test('traceColors: front colors are stacked over a full back shape, not a ring', () => {
  const img = image(64, 64, (x, y) => (inDisc(x, y, 32, 32, 8) ? YELLOW : inDisc(x, y, 32, 32, 24) ? RED : WHITE));
  const r = traceColors(img, opts);
  assert.equal(r.shapes.length, 2);
  assert.ok(near(r.shapes[0]!.color, RED));
  assert.ok(near(r.shapes[1]!.color, YELLOW));
  const want = Math.PI * (24 * S) ** 2;
  assert.ok(Math.abs(pathArea(r.shapes[0]!.d) - want) / want < 0.06);
});

test('traceColors: a ring has a hole', () => {
  const img = image(64, 64, (x, y) => (inDisc(x, y, 32, 32, 24) && !inDisc(x, y, 32, 32, 12) ? RED : WHITE));
  const r = traceColors(img, { ...opts, colors: 2 });
  assert.equal(r.shapes.length, 1);
  assert.equal(r.shapes[0]!.d.match(/M/g)?.length, 2);
  assert.match(traceSvg(r, false), /fill-rule="evenodd"/);
});

test('traceColors: minArea drops a speck', () => {
  const img = image(64, 64, (x, y) => (inDisc(x, y, 20, 20, 12) ? RED : x > 50 && x < 52 && y > 50 && y < 52 ? RED : WHITE));
  const r = traceColors(img, { ...opts, colors: 2, minArea: 20 });
  assert.equal(r.shapes.length, 1);
  assert.equal(r.shapes[0]!.d.match(/M/g)?.length, 1);
});

test('traceSvg: compact, one path per shape', () => {
  const r = traceColors(scene, opts);
  const svg = traceSvg(r, true);
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"'));
  assert.ok(!svg.includes('\n'));
  assert.equal(svg.match(/<path /g)?.length, r.shapes.length + 1);
  assert.equal(traceSvg(r, false).match(/<path /g)?.length, r.shapes.length);
});

test('cropToSubject: the subject fills the box less the margin, aspect kept, safe paths', () => {
  for (const curves of [false, true]) {
    const r = traceColors(scene, { ...opts, curves });
    const before = motifBounds(r.shapes.map((s) => s.d).join(''));
    for (const anchor of ['center', 'bottom'] as const) {
      const c = cropToSubject(r, 0.04, anchor);
      assert.equal(c.shapes.length, r.shapes.length);
      for (const s of c.shapes) assert.ok(safePathData(s.d), s.d.slice(0, 40));
      const b = motifBounds(c.shapes.map((s) => s.d).join(''));
      const [w, h] = [b.maxX - b.minX, b.maxY - b.minY];
      // The longer side spans the box less two margins of 4.
      assert.ok(Math.abs(Math.max(w, h) - 92) <= 1, `${curves} ${anchor} ${w} ${h}`);
      const aspect = (before.maxX - before.minX) / (before.maxY - before.minY);
      assert.ok(Math.abs(w / h / aspect - 1) < 0.01, `${w / h} vs ${aspect}`);
      assert.ok(Math.abs((b.minX + b.maxX) / 2 - 50) <= 1);
      if (anchor === 'bottom') assert.ok(Math.abs(b.maxY - 96) <= 1, String(b.maxY));
      else assert.ok(Math.abs((b.minY + b.maxY) / 2 - 50) <= 1);
    }
  }
});

test('sampleFlower: white background, at least 3 more colors', () => {
  const img = sampleFlower(96);
  const px = (x: number, y: number) => [0, 1, 2].map((j) => img.data[4 * (y * 96 + x) + j]).join(',');
  assert.equal(px(0, 0), '255,255,255');
  assert.equal(px(95, 95), '255,255,255');
  const flat = new Set<string>();
  for (let i = 0; i < 96 * 96; i++) flat.add(px(i % 96, Math.floor(i / 96)));
  assert.ok(flat.size >= 4);
  // Traced with 4 colors: three colored shapes on a white background.
  const t = traceColors(img, { ...opts, colors: 4 });
  assert.equal(t.shapes.length, 3);
  assert.ok(near(t.background, WHITE));
});
