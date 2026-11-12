import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './contrast.ts';
import { PICK_OPACITY, patternInvisible, pickRoles, swapRoles, worstTextContrast } from './pairing.ts';
import { PALETTES, PALETTE_SPECS, SCHEMES, makePalette } from './palettes.ts';

test('there are 24 palettes, 6 hues x 4 schemes', () => {
  assert.equal(PALETTES.length, 24);
  assert.equal(PALETTE_SPECS.length, 24);
});

test('names are unique, non-empty, and new', () => {
  const names = PALETTES.map((p) => p.name);
  for (const n of names) assert.ok(n.length > 0);
  assert.equal(new Set(names).size, names.length);
  for (const old of ['Soft Beach', 'Dark Horse', 'Classic Double Blue', 'Stark Contrast', 'Earthy Modern']) {
    assert.ok(!names.includes(old), old);
  }
});

test('every palette has 5 lower-case #rrggbb colors, pairwise different', () => {
  for (const p of PALETTES) {
    assert.equal(p.colors.length, 5, p.name);
    for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/, `${p.name}: ${c}`);
    assert.equal(new Set(p.colors).size, 5, p.name);
  }
});

test('paper and soft chips are distinguishable', () => {
  for (const p of PALETTES) {
    const r = contrastRatio(p.colors[0]!, p.colors[4]!);
    assert.ok(r >= 1.1, `${p.name}: ${r}`);
  }
});

test('pickRoles takes paper as background and ink as text, at 12 or more', () => {
  for (const p of PALETTES) {
    const r = pickRoles(p.colors);
    assert.equal(r.background, p.colors[0], p.name);
    assert.equal(r.text, p.colors[1], p.name);
    const ratio = contrastRatio(r.text, r.background);
    assert.ok(ratio >= 12, `${p.name}: ${ratio}`);
  }
});

test('light variant: visible pattern and AAA text at PICK_OPACITY', () => {
  for (const p of PALETTES) {
    const r = pickRoles(p.colors);
    assert.equal(patternInvisible(r, PICK_OPACITY), false, p.name);
    const w = worstTextContrast(r, PICK_OPACITY);
    assert.ok(w >= 7, `${p.name}: ${w}`);
  }
});

test('dark variant: visible pattern and AA text at PICK_OPACITY', () => {
  for (const p of PALETTES) {
    const r = swapRoles(pickRoles(p.colors));
    assert.equal(patternInvisible(r, PICK_OPACITY), false, p.name);
    const w = worstTextContrast(r, PICK_OPACITY);
    assert.ok(w >= 4.5, `${p.name}: ${w}`);
  }
});

test('makePalette is deterministic and PALETTES follow PALETTE_SPECS', () => {
  assert.deepEqual(makePalette('x', 200, 'triad'), makePalette('x', 200, 'triad'));
  PALETTE_SPECS.forEach(([name, hue, scheme], i) => {
    assert.deepEqual(PALETTES[i], makePalette(name, hue, scheme), name);
  });
});

test('different schemes of the same hue differ in at least 2 colors', () => {
  for (const hue of new Set(PALETTE_SPECS.map(([, h]) => h))) {
    for (const a of SCHEMES) {
      for (const b of SCHEMES) {
        if (a === b) continue;
        const ca = makePalette('a', hue, a).colors;
        const cb = makePalette('b', hue, b).colors;
        const diff = ca.filter((c, i) => c !== cb[i]).length;
        assert.ok(diff >= 2, `hue ${hue}: ${a} vs ${b} differ in ${diff}`);
      }
    }
  }
});
