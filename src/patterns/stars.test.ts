import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgFromPolylines } from '../fractal.ts';
import { hankinPolygon, hankinSegments, starGeneratorAt } from './stars.ts';
import { tiling, type TilingId } from './tilings.ts';
import { mulberry32, wrap, type Pt } from './util.ts';

const IDS: TilingId[] = ['square', 'hex', '488', '3636', '4612'];
const near = (a: Pt, b: Pt, eps = 1e-9) => Math.hypot(a[0] - b[0], a[1] - b[1]) < eps;

test('square: rays from adjacent midpoints meet where the definition says', () => {
  const sq: Pt[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  for (const deg of [30, 45, 60, 80]) {
    const t = (deg * Math.PI) / 180;
    // Ray (0.5, 0) + k (cos, sin) and ray (1, 0.5) + k (-sin, -cos) meet on the diagonal x + y = 1.
    const k = 0.5 / (Math.cos(t) + Math.sin(t));
    const want: Pt = [0.5 + k * Math.cos(t), k * Math.sin(t)];
    const got = hankinPolygon(sq, deg);
    assert.ok(near(got[0]!, [0.5, 0]) && near(got[2]!, [1, 0.5]), `${deg}`);
    assert.ok(near(got[1]!, want), `${deg}: ${got[1]} vs ${want}`);
  }
  // At 45 degrees the two rays are one line; the module takes the halfway point.
  assert.ok(near(hankinPolygon(sq, 45)[1]!, [0.75, 0.25]));
});

test('every segment endpoint lies inside or on its polygon', () => {
  for (const id of IDS)
    for (const deg of [20, 45, 60, 85])
      for (const poly of tiling(id).polygons) {
        const n = poly.length;
        for (const p of hankinPolygon(poly, deg))
          for (let i = 0; i < n; i++) {
            const [ax, ay] = poly[i]!;
            const [bx, by] = poly[(i + 1) % n]!;
            const cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax);
            assert.ok(cross >= -1e-9, `${id} ${deg}: ${p} outside`);
          }
      }
});

test('seamless: each edge midpoint gets 4 rays and each Hankin point 2, modulo the period', () => {
  for (const id of IDS)
    for (const deg of [30, 60, 80]) {
      const { width, height, segments } = hankinSegments(id, deg);
      const key = ([x, y]: Pt) => {
        const m = (v: number, p: number) => {
          const r = ((v % p) + p) % p;
          return Math.abs(r - p) < 1e-6 ? 0 : r;
        };
        return `${m(x, width).toFixed(5)},${m(y, height).toFixed(5)}`;
      };
      const count = new Map<string, number>();
      for (const s of segments) for (const p of s) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
      const mids = new Set<string>();
      for (const poly of tiling(id).polygons)
        for (let i = 0; i < poly.length; i++) {
          const [a, b] = [poly[i]!, poly[(i + 1) % poly.length]!];
          mids.add(key([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]));
        }
      for (const [k, c] of count) assert.equal(c, mids.has(k) ? 4 : 2, `${id} ${deg} at ${k}`);
    }
});

test('the angle changes the output, the same angle repeats it', () => {
  for (const id of IDS) {
    assert.deepEqual(hankinSegments(id, 60), hankinSegments(id, 60));
    assert.notDeepEqual(hankinSegments(id, 60), hankinSegments(id, 70));
  }
});

test('generator: inside the tile after wrap, text size under the cap', () => {
  let max = 0;
  for (const id of IDS)
    for (const deg of [30, 60, 80]) {
      const polys = wrap(starGeneratorAt(id, deg)(mulberry32(1), 3, 120), 120);
      for (const poly of polys) for (const [x, y] of poly) assert.ok(x >= 0 && x <= 120 && y >= 0 && y <= 120, id);
      const svg = svgFromPolylines(polys, { size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 });
      max = Math.max(max, svg.length);
      assert.ok(svg.length <= 60000, `${id} ${deg}: ${svg.length}`);
    }
  console.log(`max svg length: ${max}`);
});
