import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COLOR_SYM_DEFAULTS } from './color-sym.ts';
import { DESIGN_DEFAULTS, decodeDesign, encodeDesign, sameDesign } from './share.ts';

const KEYS = ['cs', 'cw', 'cd', 'cb', 'cm', 'co'];
const keysIn = (s: string) => [...new URLSearchParams(s).keys()].filter((k) => KEYS.includes(k));

test('color symmetry off writes none of its keys, even with other settings changed', () => {
  const off = { ...DESIGN_DEFAULTS, colorSym: { on: false, waves: 3, detail: 6, balance: false, render: 'wheel' as const, order: 7 } };
  assert.equal(encodeDesign(off), '');
  assert.ok(sameDesign(off, DESIGN_DEFAULTS));
  assert.equal(decodeDesign('').colorSym, undefined);
});

test('color symmetry on round-trips', () => {
  const cs = { on: true, waves: 3, detail: 6, balance: false, render: 'wheel' as const, order: 7 };
  const s = encodeDesign({ ...DESIGN_DEFAULTS, colorSym: cs });
  assert.equal(s, 'cs=1&cw=3&cd=6&cb=0&cm=w&co=7');
  assert.deepEqual(decodeDesign(s).colorSym, cs);
  const plain = encodeDesign({ ...DESIGN_DEFAULTS, colorSym: { ...COLOR_SYM_DEFAULTS, on: true } });
  assert.deepEqual(keysIn(plain), ['cs']);
  assert.deepEqual(decodeDesign(plain).colorSym, { ...COLOR_SYM_DEFAULTS, on: true });
  // Its keys come last, after an older link's keys.
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, seed: 5, colorSym: cs }), `s=5&${s}`);
});

test('color symmetry values clamp or fall back, never throw', () => {
  assert.deepEqual(decodeDesign('cs=1&cw=99&cd=0&co=12&cm=x&cb=7').colorSym, {
    on: true,
    waves: 8,
    detail: 1,
    balance: true,
    render: 'bands',
    order: 9,
  });
  assert.deepEqual(decodeDesign('cs=1&cw=abc&co=-3').colorSym, { ...COLOR_SYM_DEFAULTS, on: true, order: 0 });
  assert.equal(decodeDesign('cs=0&cw=3').colorSym, undefined);
  assert.equal(decodeDesign('cw=3&cm=w').colorSym, undefined);
});
