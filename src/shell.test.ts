import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateTab, stepPalette } from './shell.ts';

test('migrateTab keeps known tabs, moves motion to layout and export to use', () => {
  assert.equal(migrateTab('export'), 'use');
  assert.equal(migrateTab('use'), 'use');
  assert.equal(migrateTab('colors'), 'colors');
  assert.equal(migrateTab('repetition'), 'repetition');
  assert.equal(migrateTab('motion'), 'layout');
  assert.equal(migrateTab(null), 'pattern');
  assert.equal(migrateTab('nope'), 'pattern');
});

test('stepPalette wraps both ways', () => {
  assert.equal(stepPalette(0, 1, 3), 1);
  assert.equal(stepPalette(2, 1, 3), 0);
  assert.equal(stepPalette(0, -1, 3), 2);
});

test('stepPalette from a custom palette goes to the first one', () => {
  assert.equal(stepPalette(-1, 1, 3), 0);
  assert.equal(stepPalette(-1, -1, 3), 0);
});
