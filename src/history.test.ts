import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from './history.ts';

test('a fresh history holds only the initial value', () => {
  const h = createHistory('x');
  assert.equal(h.current(), 'x');
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), false);
  assert.equal(h.size(), 1);
});

test('undo and redo walk the pushed values', () => {
  const h = createHistory('i');
  for (const v of ['a', 'b', 'c']) h.push(v);
  assert.equal(h.undo(), 'b');
  assert.equal(h.undo(), 'a');
  assert.equal(h.redo(), 'b');
  assert.equal(h.current(), 'b');
});

test('a push after an undo clears the redo entries', () => {
  const h = createHistory('i');
  for (const v of ['a', 'b', 'c']) h.push(v);
  h.undo();
  h.push('d');
  assert.equal(h.canRedo(), false);
  assert.equal(h.current(), 'd');
  assert.equal(h.undo(), 'b');
});

test('pushing a value equal to the current one does nothing', () => {
  const h = createHistory({ n: 1 }, 50, (a, b) => a.n === b.n);
  h.push({ n: 1 });
  assert.equal(h.size(), 1);
  h.push({ n: 2 });
  h.push({ n: 2 });
  assert.equal(h.size(), 2);
});

test('the limit drops the oldest entries', () => {
  const h = createHistory(0, 3);
  for (const v of [1, 2, 3, 4, 5]) h.push(v);
  assert.equal(h.size(), 3);
  assert.equal(h.undo(), 4);
  assert.equal(h.undo(), 3);
  assert.equal(h.undo(), undefined);
  assert.equal(h.current(), 3);
});

test('undo and redo at the ends return undefined and do not move', () => {
  const h = createHistory('i');
  assert.equal(h.undo(), undefined);
  assert.equal(h.redo(), undefined);
  h.push('a');
  assert.equal(h.redo(), undefined);
  assert.equal(h.current(), 'a');
  h.undo();
  assert.equal(h.undo(), undefined);
  assert.equal(h.current(), 'i');
});
