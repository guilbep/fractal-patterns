import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssBackground, cssPlate, svgToDataUri } from './css.ts';
import { generate, KINDS } from './fractal.ts';

const PREFIX = 'data:image/svg+xml,';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><path stroke="#336699" d="M0 0h4"/></svg>';
const roundTrip = (uri: string) => decodeURIComponent(uri.slice(PREFIX.length)).replaceAll("'", '"');

test('svgToDataUri matches the exact vector', () => {
  assert.equal(
    svgToDataUri(svg),
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Cpath stroke='%23336699' d='M0 0h4'/%3E%3C/svg%3E",
  );
});

test('svgToDataUri round-trips', () => {
  assert.equal(roundTrip(svgToDataUri(svg)), svg);
});

test('data URI has no raw #, <, >, or "', () => {
  assert.doesNotMatch(svgToDataUri(svg), /[#<>"]/);
});

test('a literal percent is escaped', () => {
  assert.equal(svgToDataUri('<svg width="50%"/>'), "data:image/svg+xml,%3Csvg width='50%25'/%3E");
});

test('cssBackground returns two lines', () => {
  const css = cssBackground(svg, '#f5f5f5');
  assert.equal(css, 'background-color: #f5f5f5;\nbackground-image: url("' + svgToDataUri(svg) + '");');
  const second = css.split('\n')[1] ?? '';
  assert.equal(second.split('"').length - 1, 2);
});

test('every generated kind encodes safely and round-trips', () => {
  for (const kind of KINDS) {
    const out = generate({ kind, seed: 1, depth: 3, size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 });
    const uri = svgToDataUri(out);
    assert.doesNotMatch(uri, /[#<>"\n]/, kind);
    assert.equal(roundTrip(uri), out, kind);
  }
});

test('cssPlate without blur', () => {
  assert.equal(
    cssPlate('#ffffff', { opacity: 0.85, radius: 12, blur: 0 }),
    '.fp-plate {\n  background-color: rgb(255 255 255 / 0.85);\n  border-radius: 12px;\n  padding: 1rem;\n}',
  );
});

test('cssPlate with blur', () => {
  assert.equal(
    cssPlate('#12232e', { opacity: 0.5, radius: 0, blur: 4 }),
    '.fp-plate {\n  background-color: rgb(18 35 46 / 0.5);\n  border-radius: 0px;\n  padding: 1rem;\n  backdrop-filter: blur(4px);\n  -webkit-backdrop-filter: blur(4px);\n}',
  );
});

test('cssPlate prints opacity 1 without decimals', () => {
  assert.ok(cssPlate('#ffffff', { opacity: 1, radius: 8, blur: 0 }).includes('rgb(255 255 255 / 1);'));
});
