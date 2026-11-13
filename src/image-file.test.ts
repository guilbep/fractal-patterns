import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize } from './image-file.ts';

test('fitSize scales the longer side down to max', () => {
  assert.deepEqual(fitSize(1000, 500, 256), [256, 128]);
  assert.deepEqual(fitSize(500, 1000, 256), [128, 256]);
});

test('fitSize does not upscale', () => {
  assert.deepEqual(fitSize(100, 50, 256), [100, 50]);
});

test('fitSize keeps at least 1 px on the short side', () => {
  assert.deepEqual(fitSize(3, 1000, 256), [1, 256]);
});

test('fitSize with enlarge brings the longer side to max, up or down', () => {
  assert.deepEqual(fitSize(40, 30, 256, true), [256, 192]);
  assert.deepEqual(fitSize(1000, 500, 256, true), [256, 128]);
  assert.deepEqual(fitSize(40, 30, 256), [40, 30]);
});
