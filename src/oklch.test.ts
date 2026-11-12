import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHex } from './contrast.ts';
import { hexToOklch, oklchToHex } from './oklch.ts';

test('oklchToHex maps white and black', () => {
  assert.equal(oklchToHex(1, 0, 0), '#ffffff');
  assert.equal(oklchToHex(0, 0, 0), '#000000');
});

test('a gray has equal channels', () => {
  for (const l of [0.2, 0.5, 0.8]) {
    const [r, g, b] = parseHex(oklchToHex(l, 0, 0));
    assert.ok(r === g && g === b, `l ${l}: ${r}, ${g}, ${b}`);
  }
});

test('hex -> oklch -> hex round trip is exact', () => {
  for (const hex of ['#336699', '#de493c', '#f5f5f5', '#12232e']) {
    assert.equal(oklchToHex(...hexToOklch(hex)), hex);
  }
});

test('an out-of-gamut request returns a valid color', () => {
  assert.match(oklchToHex(0.7, 0.4, 150), /^#[0-9a-f]{6}$/);
});
