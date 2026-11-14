import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_SYM_DEFAULTS, colorSym, ORDERS, orderedColors } from './color-sym.ts';

const P = ['a', 'b', 'c', 'd', 'e'];

test('orders: 5 rotations, then the 5 rotations of the reversed palette', () => {
  assert.deepEqual(orderedColors(P, 0), P);
  assert.deepEqual(orderedColors(P, 1), ['b', 'c', 'd', 'e', 'a']);
  assert.deepEqual(orderedColors(P, 5), ['e', 'd', 'c', 'b', 'a']);
  assert.deepEqual(orderedColors(P, 6), ['d', 'c', 'b', 'a', 'e']);
  assert.deepEqual(orderedColors(P, ORDERS), P); // wraps
  assert.equal(new Set(Array.from({ length: ORDERS }, (_, o) => orderedColors(P, o).join())).size, ORDERS);
});

test('a short palette repeats its colors to five', () => {
  assert.deepEqual(orderedColors(['x', 'y', 'z'], 0), ['x', 'y', 'z', 'x', 'y']);
});

test('off by default: Lines stays today’s drawing', () => {
  assert.equal(COLOR_SYM_DEFAULTS.on, false);
  assert.equal(colorSym.on, false);
});
