import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, parseDesign, removeItem, removeMany } from './design.ts';
import { BASIC_STAMPS } from './stamps.ts';
import {
  canRedo,
  canUndo,
  commit,
  defaultDesign,
  design,
  redo,
  resetDesign,
  selectAll,
  selectedId,
  selectedIds,
  undo,
  useStamp,
} from './store.ts';

test('defaultDesign is a pure 16-item design that survives a stored round trip', () => {
  const d = defaultDesign();
  assert.equal(d.items.length, 16);
  assert.equal(d.stamps.length, 12);
  assert.deepEqual(defaultDesign(), d);
  assert.deepEqual(parseDesign(JSON.parse(JSON.stringify(d))), d);
});

// The store is module state: these steps run in order on one shared design.
test('commit, undo and redo walk the history', () => {
  assert.equal(canUndo.value, false);
  const start = design.value;
  const next = addItem(start, 0, 10, 10);
  commit(next);
  assert.equal(canUndo.value, true);
  undo();
  assert.equal(design.value, start);
  assert.equal(canRedo.value, true);
  redo();
  assert.equal(design.value, next);
});

test('useStamp reuses an existing stamp and appends a new one', () => {
  resetDesign();
  assert.equal(useStamp(BASIC_STAMPS[3]!), 3);
  assert.equal(design.value.stamps.length, 12);
  const own = { name: 'Mine', box: 10, parts: [{ d: 'M0 0H10V10z', paint: 'fill' as const, color: '#123456' }] };
  assert.equal(useStamp(own), 12);
  assert.equal(design.value.stamps.length, 13);
  assert.equal(useStamp(own), 12);
});

test('the selection clears when a commit removes its item', () => {
  const id = design.value.items[0]!.id;
  selectedId.value = id;
  commit(removeItem(design.value, id));
  assert.equal(selectedId.value, null);
});

test('selectAll then removing two items leaves the third selected', () => {
  resetDesign();
  const [a, b, c] = design.value.items.slice(0, 3).map((it) => it.id);
  commit({ ...design.value, items: design.value.items.slice(0, 3) });
  selectAll();
  commit(removeMany(design.value, [a!, b!]));
  assert.deepEqual(selectedIds.value, [c]);
  assert.equal(selectedId.value, c);
});
