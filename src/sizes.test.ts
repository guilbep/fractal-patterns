import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZE_MAX, SIZE_MIN, SIZE_PRESETS, markedPreset } from './sizes.ts';

test('presets sit inside the range', () => {
  assert.deepEqual([...SIZE_PRESETS], [64, 96, 120, 128, 192, 256]);
  for (const p of SIZE_PRESETS) assert.ok(p >= SIZE_MIN && p <= SIZE_MAX && p % 4 === 0, `${p}`);
});

test('markedPreset', () => {
  assert.equal(markedPreset(128), 128);
  assert.equal(markedPreset(256), 256);
  assert.equal(markedPreset(120), 120);
  assert.equal(markedPreset(124), null);
  assert.equal(markedPreset(129), null);
});
