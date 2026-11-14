import assert from 'node:assert/strict';
import test from 'node:test';
import { PHONES } from './phones.ts';

// Published CSS widths (Apple compare page and yesviz), to check width / dpr.
const CSS_WIDTH: Record<string, number> = {
  'iPhone 17': 402,
  'iPhone Air': 420,
  'iPhone 17 Pro': 402,
  'iPhone 17 Pro Max': 440,
  'iPhone 16e': 390,
  'iPhone 16': 393,
  'iPhone 16 Plus': 430,
  'iPhone 16 Pro': 402,
  'iPhone 16 Pro Max': 440,
  'iPhone 15': 393,
  'iPhone 15 Pro': 393,
  'iPhone 15 Pro Max': 430,
  'iPhone 14': 390,
  'iPhone 13': 390,
};

test('32 phones, positive integer sizes, a density from 1 to 4, unique names', () => {
  assert.equal(PHONES.length, 32);
  for (const p of PHONES) {
    for (const n of [p.width, p.height]) assert.ok(Number.isInteger(n) && n > 0, p.model);
    assert.ok(p.dpr >= 1 && p.dpr <= 4, p.model);
  }
  assert.equal(new Set(PHONES.map((p) => p.model)).size, 32);
});

test('the confirmed iPhones: width / dpr is the published CSS width, within 2 px', () => {
  const confirmed = PHONES.filter((p) => p.confirmed);
  assert.equal(confirmed.length, 14);
  for (const p of confirmed) {
    const css = CSS_WIDTH[p.model];
    assert.ok(css, p.model);
    assert.ok(Math.abs(p.width / p.dpr - css) <= 2, `${p.model}: ${p.width / p.dpr} vs ${css}`);
  }
});
