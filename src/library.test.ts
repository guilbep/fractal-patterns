import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILIES, KINDS, KIND_FAMILY, type Kind } from './fractal.ts';
import { kindsForTab, parseLibTab, tabForKind } from './library.ts';

const a = KINDS.find((k) => KIND_FAMILY[k] === 'fractal')!;
const b = KINDS.find((k) => KIND_FAMILY[k] === 'line')!;

test('tabForKind stays on all, stays on the family of the kind, else moves', () => {
  assert.equal(tabForKind('all', b), 'all');
  assert.equal(tabForKind('fractal', a), 'fractal');
  assert.equal(tabForKind('fractal', b), 'line');
});

test('kindsForTab returns the family kinds, and all 79 in family order', () => {
  assert.ok(kindsForTab('line').every((k) => KIND_FAMILY[k] === 'line'));
  assert.ok(kindsForTab('line').includes(b));
  const all = kindsForTab('all');
  assert.equal(all.length, 79);
  assert.equal(new Set(all).size, 79);
  assert.deepEqual(
    all,
    FAMILIES.flatMap((f) => kindsForTab(f)),
  );
  const idx = all.map((k: Kind) => FAMILIES.indexOf(KIND_FAMILY[k]));
  assert.deepEqual(
    idx,
    [...idx].sort((x, y) => x - y),
  );
});

test('parseLibTab keeps known tabs and falls back to the family of the kind', () => {
  assert.equal(parseLibTab('all', a), 'all');
  assert.equal(parseLibTab('line', a), 'line');
  assert.equal(parseLibTab('nope', b), 'line');
  assert.equal(parseLibTab(null, a), 'fractal');
});
