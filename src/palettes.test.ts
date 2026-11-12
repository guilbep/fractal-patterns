import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES } from './palettes.ts';

const byName = (name: string) => PALETTES.find((p) => p.name === name);

test('there are 35 palettes', () => {
  assert.equal(PALETTES.length, 35);
});

test('every color is lower-case #rrggbb', () => {
  for (const p of PALETTES) {
    for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/, `${p.name}: ${c}`);
  }
});

test('every palette has 3 to 5 colors', () => {
  for (const p of PALETTES) {
    assert.ok(p.colors.length >= 3 && p.colors.length <= 5, p.name);
  }
});

test('names are unique and non-empty', () => {
  const names = PALETTES.map((p) => p.name);
  for (const n of names) assert.ok(n.length > 0);
  assert.equal(new Set(names).size, names.length);
});

test('spot checks', () => {
  assert.deepEqual(byName('Soft Beach')?.colors, ['#51e2f5', '#9df9ef', '#edf756', '#ffa8b6', '#a28089']);
  assert.deepEqual(byName('Goldifox')?.colors, ['#a39274', '#dfd8c8', '#252523']);
  const last = PALETTES[PALETTES.length - 1];
  assert.equal(last?.name, 'Greenery and Pearl');
  assert.equal(last?.colors[last.colors.length - 1], '#ffffff');
});
