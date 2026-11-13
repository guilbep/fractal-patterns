import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeFileName, tileCss } from './export-file.ts';

test('safeFileName', () => {
  assert.equal(safeFileName('My Pattern #1'), 'my-pattern-1');
  assert.equal(safeFileName('  --  '), 'pattern');
  assert.equal(safeFileName('', 'tile'), 'tile');
  assert.equal(safeFileName('Été à Zürich'), 't-z-rich');
  assert.equal(safeFileName('a'.repeat(100)).length, 60);
});

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';

test('tileCss with a background', () => {
  const css = tileCss(SVG, 240, 120, '#ffffff');
  assert.ok(css.includes('background-color: #ffffff'));
  assert.ok(css.includes('background-size: 240px 120px'));
  assert.ok(css.includes('url("data:image/svg+xml'));
  assert.ok(!css.includes('<'));
});

test('tileCss without a background', () => {
  assert.ok(!tileCss(SVG, 240, 120, null).includes('background-color'));
});

test('tileCss rounds to one decimal', () => {
  assert.ok(tileCss(SVG, 100.25, 50, null).includes('background-size: 100.3px 50px'));
});
