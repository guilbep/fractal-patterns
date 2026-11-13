import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { safePathData } from '../motifgrid.ts';
import type { Rgba } from './colortrace.ts';
import { inkMask, inkMotif, inkSvg, inkThreshold, traceInk } from './inktrace.ts';

type RGB = readonly [number, number, number];
const INK: RGB = [0x14, 0x3c, 0x14];
const N = 256;
type Seg = readonly [number, number, number, number, number]; // x0 y0 x1 y1 thickness

const segDist = (px: number, py: number, [x0, y0, x1, y1]: Seg) => {
  const [dx, dy] = [x1 - x0, y1 - y0];
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - x0 - t * dx, py - y0 - t * dy);
};

// Line art: coverage 0..1 per pixel with a one pixel soft edge.
function drawing(segs: readonly Seg[], rings: readonly (readonly [number, number])[] = []): Float32Array {
  const cov = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [px, py] = [x + 0.5, y + 0.5];
      let sd = Infinity;
      for (const s of segs) sd = Math.min(sd, segDist(px, py, s) - s[4] / 2);
      for (const [r, t] of rings) sd = Math.min(sd, Math.abs(Math.hypot(px - 128, py - 128) - r) - t / 2);
      cov[y * N + x] = Math.min(1, Math.max(0, 0.5 - sd));
    }
  }
  return cov;
}

const spokes: Seg[] = [0, 1, 2].map((i) => {
  const a = (i * 2 * Math.PI) / 3 + 0.3;
  return [128 + 62 * Math.cos(a), 128 + 62 * Math.sin(a), 128 + 110 * Math.cos(a), 128 + 110 * Math.sin(a), 3 + i];
});
const hatches: Seg[] = [0, 1, 2, 3, 4, 5].map((i) => [12 + 7 * i, 12, 22 + 7 * i, 34, 3]);
const ART = drawing(
  [...spokes, ...hatches],
  [
    [60, 4],
    [80, 6],
  ],
);

function render(cov: Float32Array, bg: (x: number, y: number) => RGB | null, ink: RGB = INK): Rgba {
  const data = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const a = cov[i]!;
    const b = bg(i % N, Math.floor(i / N));
    if (b) data.set([...b.map((v, j) => v + (ink[j]! - v) * a), 255], 4 * i);
    else data.set([...ink, Math.round(a * 255)], 4 * i);
  }
  return { width: N, height: N, data };
}

const WHITE: RGB = [255, 255, 255];
const white = render(ART, () => WHITE);
const checker = render(ART, (x, y) => ((Math.floor(x / 16) + Math.floor(y / 16)) % 2 ? [0xcc, 0xcc, 0xcc] : WHITE));
const transparent = render(ART, () => null);
const opts = { size: 100, detail: 0.15, smooth: 0.8, minArea: 0.05, curves: false };
const close = (a: number, b: number, rel: number, what: string) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${what}: ${a} vs ${b}`);
const scaledInk = (img: Rgba) => inkMask(img, {}).coverage * N * N * (100 / N) ** 2;

test('dark ink on white: one safe path with holes, area matches the mask', () => {
  const t = inkThreshold(white);
  assert.equal(t.inkIsDark, true);
  assert.ok(t.contrast > 0.5, String(t.contrast));
  const r = traceInk(white, opts);
  assert.ok(safePathData(r.d));
  assert.ok(r.holes >= 1);
  close(r.area, scaledInk(white), 0.12, 'area');
});

test('a baked checkerboard and a transparent ground trace like white', () => {
  const ref = traceInk(white, opts);
  for (const img of [checker, transparent]) {
    const r = traceInk(img, opts);
    close(r.loops, ref.loops, 0.1, 'loops');
    close(r.area, ref.area, 0.1, 'area');
  }
});

test('white ink on a dark ground', () => {
  const img = render(ART, () => [20, 30, 25], [250, 250, 245]);
  assert.equal(inkThreshold(img).inkIsDark, false);
  const r = traceInk(img, opts);
  close(r.area, scaledInk(img), 0.12, 'area');
});

test('flat and gradient images', () => {
  const flat = render(new Float32Array(N * N), () => [128, 140, 130]);
  assert.ok(inkThreshold(flat).contrast < 0.15);
  const r = traceInk(flat, opts);
  assert.equal(r.d, '');
  assert.equal(r.loops, 0);
  assert.deepEqual(inkMotif(r, '#143c14').shapes, []);
  const grad = render(new Float32Array(N * N), (x) => [x, x, x]);
  assert.ok(Number.isFinite(inkThreshold(grad).contrast));
});

test('minArea, threshold and invert', () => {
  const cov = new Float32Array(N * N);
  for (const i of [100 * N + 100, 100 * N + 101, 101 * N + 100, 101 * N + 101]) cov[i] = 1;
  const speck = render(cov, () => WHITE);
  assert.equal(traceInk(speck, { ...opts, minArea: 0 }).loops, 1);
  assert.equal(traceInk(speck, { ...opts, minArea: 1 }).loops, 0);
  assert.ok(inkMask(white, { threshold: 0.99 }).coverage < 0.001);
  const base = inkMask(white, {}).coverage;
  close(inkMask(white, { invert: true }).coverage, 1 - base, 1e-9, 'invert');
});

test('curves and maxPoints', () => {
  const c = traceInk(white, { ...opts, curves: true });
  assert.match(c.d, /[Cc]/);
  assert.doesNotMatch(c.d, /L/);
  const m = traceInk(white, { ...opts, maxPoints: 150 });
  assert.ok(m.detailUsed > opts.detail);
  assert.ok(m.points <= 150);
  assert.ok(safePathData(m.d));
});

test('line thickness is kept', () => {
  const img = render(drawing([[78, 128.5, 178, 128.5, 5]]), () => WHITE);
  const r = traceInk(img, { ...opts, size: N });
  assert.equal(r.loops, 1);
  const width = r.area / 100;
  assert.ok(width > 4 && width < 6, String(width));
});

test('deterministic, svg and hygiene', () => {
  assert.deepEqual(traceInk(checker, opts), traceInk(checker, opts));
  const r = traceInk(white, opts);
  assert.match(inkSvg(r, '#143c14', null), /^<svg[^>]*><path fill="#143c14" fill-rule="evenodd" d="M/);
  assert.equal(inkMotif(r, '#143c14').shapes.length, 1);
  const src = readFileSync(new URL('./inktrace.ts', import.meta.url), 'utf8');
  assert.ok(!src.includes('node:') && !src.includes('Math.random'));
});

test('maxLength caps the path data, default 20,000', () => {
  const m = traceInk(white, { ...opts, maxLength: 300 });
  assert.ok(m.d.length <= 300);
  assert.ok(m.detailUsed > opts.detail);
  assert.equal(traceInk(white, { ...opts, maxLength: 20000 }).d, traceInk(white, opts).d);
});
