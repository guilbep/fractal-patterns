import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultDesign } from './store.ts';
import { fillDesign, resizeDesign, usedStamps } from './tile-fill.ts';
import type { FillChoice } from './tile-fill.ts';

const d = defaultDesign();
const choice: FillChoice = {
  columns: 3,
  rows: 2,
  stampIndices: [0, 1],
  seed: 5,
  size: 0.5,
  sizeJitter: 0,
  jitter: 0,
  rotate: 'none',
  stagger: false,
  flip: false,
  palette: null,
};
const near = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);

test('the fixture', () => {
  assert.equal(d.width, 240);
  assert.equal(d.height, 240);
  assert.equal(d.stamps.length, 12);
  assert.equal(d.items.length, 16);
  assert.equal(d.background, '#f4f1ea');
});

test('usedStamps: the stamps of the items, or all of them', () => {
  const used = usedStamps(d);
  const want = ['Dot', 'Leaf', 'Drop', 'Ring'].map((n) => d.stamps.findIndex((s) => s.name === n)).sort((a, b) => a - b);
  assert.equal(used.length, 4);
  assert.deepEqual(used, want);
  assert.deepEqual(usedStamps({ ...d, items: [] }), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('fillDesign without a palette', () => {
  const f = fillDesign(d, choice);
  assert.deepEqual(
    f.items.map((it) => it.id),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(f.background, '#f4f1ea');
  for (const it of f.items) {
    assert.deepEqual(it.colors, []);
    assert.ok(it.stamp === 0 || it.stamp === 1);
    near(it.scale, 0.4);
  }
  near(f.items[0]!.x, 40);
  near(f.items[0]!.y, 60);
});

test('fillDesign with a palette', () => {
  const f = fillDesign(d, { ...choice, palette: ['#101010', '#aa0000', '#00aa00'] });
  assert.equal(f.background, '#101010');
  for (const it of f.items) for (const c of it.colors) assert.ok(c === '#aa0000' || c === '#00aa00', c);
  assert.ok(f.items.every((it) => it.colors.length > 0));
});

test('fillDesign ignores missing stamps', () => {
  assert.equal(fillDesign(d, { ...choice, stampIndices: [99] }), d);
  assert.ok(fillDesign(d, { ...choice, stampIndices: [0, 99] }).items.every((it) => it.stamp === 0));
});

test('fillDesign is seeded', () => {
  assert.deepEqual(fillDesign(d, choice), fillDesign(d, choice));
  assert.notDeepEqual(fillDesign(d, { ...choice, jitter: 0.5 }), fillDesign(d, { ...choice, seed: 6, jitter: 0.5 }));
});

test('resizeDesign moves the items in proportion', () => {
  const r = resizeDesign(d, 480, 120);
  assert.equal(r.width, 480);
  assert.equal(r.height, 120);
  r.items.forEach((it, i) => {
    const o = d.items[i]!;
    near(it.x, o.x * 2);
    near(it.y, o.y / 2);
    assert.equal(it.scale, o.scale);
  });
  const c = resizeDesign(d, 5, 99999);
  assert.equal(c.width, 16);
  assert.equal(c.height, 2000);
  resizeDesign(d, 240, 240).items.forEach((it, i) => {
    assert.equal(it.x, d.items[i]!.x);
    assert.equal(it.y, d.items[i]!.y);
  });
});

test('no function changes its input', () => {
  const before = structuredClone(d);
  usedStamps(d);
  fillDesign(d, { ...choice, palette: ['#101010', '#aa0000'] });
  resizeDesign(d, 100, 300);
  assert.deepEqual(d, before);
});

test('source hygiene', () => {
  for (const file of ['./tile-fill.ts', './TilePanel.vue']) {
    const src = readFileSync(new URL(file, import.meta.url), 'utf8');
    for (const bad of ['Math.random', 'Date']) assert.ok(!src.includes(bad), `${file}: ${bad}`);
  }
});
