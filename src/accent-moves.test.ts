import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyMoves, clampMove, decodeMoves, encodeMoves } from './accent-moves.ts';
import type { Poly } from './patterns/util.ts';

const sq = (x: number, y: number): Poly => [
  [x, y],
  [x + 10, y],
  [x + 10, y + 10],
  [x, y + 10],
  [x, y],
];

test('applyMoves translates only the moved shapes, by their move', () => {
  const out = applyMoves([sq(10, 10), sq(50, 50), sq(80, 20)], new Map([[1, [4.2, -3]]]), 120, 120);
  assert.deepEqual(out[0], sq(10, 10));
  assert.deepEqual(out[1], sq(54.2, 47));
  assert.deepEqual(out[2], sq(80, 20));
});

test('applyMoves ignores indexes past the shape count, and clamps a shape whole inside the tile', () => {
  const out = applyMoves(
    [sq(100, 5)],
    new Map([
      [0, [50, -20]],
      [7, [1, 1]],
    ]),
    120,
    120,
  );
  assert.deepEqual(out, [sq(110, 0)]);
  assert.deepEqual(clampMove(sq(100, 5), [-30, 2], 120, 120), [-30, 2]);
});

test('am round trip: tenths of a px, sorted by index, minus allowed', () => {
  const s = encodeMoves(
    new Map([
      [5, [0, 3]],
      [0, [4.2, -1]],
    ]),
  );
  assert.equal(s, '0.42.-10_5.0.30');
  assert.deepEqual(
    [...decodeMoves(s)],
    [
      [0, [4.2, -1]],
      [5, [0, 3]],
    ],
  );
});

test('am: bad parts are ignored, the first of a repeated index wins', () => {
  assert.deepEqual([...decodeMoves('x_1.2_3.4.5.6_2.a.1_4.10.-20_4.1.1_6.0.0_')], [[4, [1, -2]]]);
  assert.equal(decodeMoves(null).size, 0);
});

test('no moves, or only zero moves, give an empty value (no am key)', () => {
  assert.equal(encodeMoves(new Map()), '');
  assert.equal(encodeMoves(new Map([[3, [0.01, -0.04]]])), '');
});
