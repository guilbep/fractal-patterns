import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blend, contrastRatio, parseHex, passesNonText, textLevel, toHex } from './contrast.ts';

test('black on white is 21, order-independent', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(contrastRatio('#ffffff', '#000000'), contrastRatio('#000000', '#ffffff'));
});

test('same color is 1', () => {
  assert.equal(contrastRatio('#fff', '#ffffff'), 1);
});

test('#767676 on white passes AA', () => {
  const r = contrastRatio('#767676', '#ffffff');
  assert.ok(r >= 4.5);
  assert.equal(textLevel(r), 'AA');
});

test('#777777 on white fails normal, AA large', () => {
  const r = contrastRatio('#777777', '#ffffff');
  assert.ok(r < 4.5);
  assert.equal(textLevel(r), 'fail');
  assert.equal(textLevel(r, true), 'AA');
});

test('thresholds are not rounded', () => {
  assert.equal(textLevel(4.499), 'fail');
  assert.equal(textLevel(7), 'AAA');
  assert.equal(passesNonText(2.999), false);
  assert.equal(passesNonText(3), true);
});

test('parseHex', () => {
  assert.deepEqual(parseHex('#ABC'), [170, 187, 204]);
  for (const bad of ['red', '#12', '#gggggg']) assert.throws(() => parseHex(bad), Error);
});

test('blend', () => {
  assert.equal(blend('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(blend('#123456', '#abcdef', 0), '#abcdef');
  assert.equal(blend('#123456', '#abcdef', 1), '#123456');
  assert.equal(blend('#123456', '#abcdef', 2), '#123456');
});

test('toHex round-trips lower-case', () => {
  assert.equal(toHex(parseHex('#1561AD')), '#1561ad');
});
