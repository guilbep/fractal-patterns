import { test } from 'node:test';
import assert from 'node:assert/strict';
import { busiestRegion, clampRegion, loupeView, maxShift } from './precision-loupe.ts';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('maxShift: hand-computed shifts of (1.234, 5.678)', () => {
  const polys = [
    [
      [1.234, 5.678],
      [3, 3],
    ],
  ] as const;
  near(maxShift(polys, 1), Math.hypot(0.034, 0.022)); // to (1.2, 5.7)
  near(maxShift(polys, 1), 0.0405, 1e-4);
  near(maxShift(polys, 0), Math.hypot(0.234, 0.322)); // to (1, 6)
  near(maxShift(polys, 0), 0.398, 1e-3);
});

test('loupeView: exact keeps full floats, rounded uses the export rounding', () => {
  const v = loupeView(
    [
      [
        [1.234, 5.678],
        [3.21, 5.678],
      ],
    ],
    200,
    1,
    { x: 0, y: 0, w: 25 },
  );
  assert.equal(v.exact, 'M1.234 5.678L3.21 5.678');
  assert.equal(v.rounded, 'M1.2 5.7h2');
  near(v.maxShift, Math.hypot(0.034, 0.022));
});

test('loupeView: segments far from the region are left out, a run breaks around them', () => {
  const poly = [
    [0, 0],
    [10, 0],
    [100, 100],
    [110, 100],
    [10, 10],
    [20, 10],
  ] as const;
  const v = loupeView([poly], 200, 0, { x: 0, y: 0, w: 25 });
  assert.equal(v.exact, 'M0 0L10 0L100 100M110 100L10 10L20 10');
  assert.equal(
    loupeView(
      [
        [
          [150, 150],
          [160, 160],
        ],
      ],
      200,
      0,
      { x: 0, y: 0, w: 25 },
    ).exact,
    '',
  );
});

test('maxShift: precision 3 stays within 0.0005 × √2 for any input', () => {
  let s = 12345;
  const next = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648) * 400 - 100;
  const polys = Array.from({ length: 50 }, () => Array.from({ length: 40 }, () => [next(), next()] as const));
  assert.ok(maxShift(polys, 3) <= 0.0005 * Math.SQRT2 + 1e-9);
  assert.ok(maxShift(polys, 3) > 0);
});

test('busiestRegion: the 1/8 cell with the most segment ends, clamped', () => {
  const polys = [
    [
      [1, 1],
      [2, 2],
    ],
    [
      [60, 110],
      [61, 111],
      [62, 112],
    ],
  ] as const;
  assert.deepEqual(busiestRegion(polys, 200, 200), { x: 50, y: 100, w: 25 });
  assert.deepEqual(busiestRegion([], 200, 200), { x: 0, y: 0, w: 25 });
  assert.deepEqual(clampRegion({ x: 190, y: -5, w: 25 }, 200, 100), { x: 175, y: 0, w: 25 });
});
