import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAllColors, setPartColor, usedColors } from './item-colors.ts';
import type { Design, Item } from './types.ts';

const item = (id: number, stamp: number, colors: string[]): Item => ({
  id,
  stamp,
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  flip: false,
  opacity: 1,
  colors,
});
const itemA0 = item(1, 0, []);
const itemB = item(2, 1, ['#AA0000']);
const d: Design = {
  width: 200,
  height: 200,
  background: '#FFFFFF',
  repeat: 'straight',
  strokeWidth: 3,
  stamps: [
    { name: 'A', box: 100, parts: [{ d: 'M0 0H10V10Z', paint: 'fill', color: '#111111' }] },
    {
      name: 'B',
      box: 100,
      parts: [
        { d: 'M0 0H10V10Z', paint: 'fill', color: '#222222' },
        { d: 'M0 0H10V10Z', paint: 'fill', color: '#333333' },
      ],
    },
  ],
  items: [itemA0, itemB, item(3, 0, ['#111111'])],
};

test('lists the used colors in order of first use', () => {
  assert.deepEqual(usedColors(d), ['#ffffff', '#111111', '#aa0000', '#333333']);
  assert.deepEqual(usedColors({ ...d, background: null }), ['#111111', '#aa0000', '#333333']);
  assert.deepEqual(usedColors(d, 2), ['#ffffff', '#111111']);
});

test('sets one part color without holes', () => {
  assert.deepEqual(setPartColor(itemB, ['#222222', '#333333'], 1, '#00ff00'), ['#AA0000', '#00ff00']);
  assert.deepEqual(setPartColor(itemA0, ['#111111'], 0, '#00ff00'), ['#00ff00']);
  assert.deepEqual(setPartColor(item(4, 0, []), ['#000001', '#000002', '#000003'], 2, '#ffffff'), ['#000001', '#000002', '#ffffff']);
});

test('sets all part colors', () => {
  assert.deepEqual(setAllColors(['#222222', '#333333'], '#abcdef'), ['#abcdef', '#abcdef']);
});

test('changes no input', () => {
  const before = structuredClone(d);
  const parts = ['#222222', '#333333'];
  usedColors(d);
  setPartColor(itemB, parts, 0, '#00ff00');
  setAllColors(parts, '#abcdef');
  assert.deepEqual(d, before);
  assert.deepEqual(parts, ['#222222', '#333333']);
});
