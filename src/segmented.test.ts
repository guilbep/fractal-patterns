import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextIndex } from './segmented.ts';

const none = [false, false, false, false];

test('arrows step and wrap around', () => {
  assert.equal(nextIndex(4, 0, 'ArrowRight', none), 1);
  assert.equal(nextIndex(4, 3, 'ArrowRight', none), 0);
  assert.equal(nextIndex(4, 0, 'ArrowLeft', none), 3);
  assert.equal(nextIndex(4, 0, 'ArrowDown', none), 1);
  assert.equal(nextIndex(4, 0, 'ArrowUp', none), 3);
});

test('disabled options are skipped', () => {
  assert.equal(nextIndex(4, 0, 'ArrowRight', [false, true, false, false]), 2);
  assert.equal(nextIndex(4, 2, 'Home', [true, false, false, false]), 1);
  assert.equal(nextIndex(4, 0, 'End', [false, false, false, true]), 2);
});

test('other keys and a single option stay put', () => {
  assert.equal(nextIndex(4, 1, 'a', none), 1);
  assert.equal(nextIndex(1, 0, 'ArrowRight', [false]), 0);
});
