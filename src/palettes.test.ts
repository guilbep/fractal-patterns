import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './contrast.ts';
import { PICK_OPACITY, patternInvisible, swapRoles, worstTextContrast } from './pairing.ts';
import { worstTextContrastSurfaces } from './fills.ts';
import { inGamut } from './oklch.ts';
import { mulberry32 } from './patterns/util.ts';
import {
  PALETTE_GROUPS,
  PALETTES,
  PALETTE_SPECS,
  makePalette,
  paletteLch,
  paletteRoles,
  randomPaletteSpec,
  type PaletteSpec,
} from './palettes.ts';

const rnd = mulberry32(42);
const RANDOM: PaletteSpec[] = Array.from({ length: 500 }, () => randomPaletteSpec(rnd));
const ALL_SPECS = [...PALETTE_SPECS, ...RANDOM];
const ALL = ALL_SPECS.map((s, i) => ({
  ...makePalette(s),
  name: `${s.name} ${i} (hue ${s.hue}, ${s.accent}${s.dark ? ', dark' : ''})`,
  dark: s.dark,
}));
const hueDist = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

test('there are 24 curated palettes, 16 light and 8 dark, more cool bases than warm', () => {
  assert.equal(PALETTES.length, 24);
  assert.equal(PALETTE_SPECS.filter((s) => s.dark).length, 8);
  const cool = PALETTE_SPECS.filter((s) => s.hue >= 180 && s.hue <= 280).length;
  assert.ok(cool > 24 - cool, `${cool} cool`);
});

test('names are unique, non-empty, and new', () => {
  const names = PALETTES.map((p) => p.name);
  for (const n of names) assert.ok(n.length > 0);
  assert.equal(new Set(names).size, names.length);
  for (const old of ['Soft Beach', 'Dark Horse', 'Classic Double Blue', 'Stark Contrast', 'Earthy Modern', 'Random']) {
    assert.ok(!names.includes(old), old);
  }
});

test('every palette has 5 lower-case #rrggbb colors, pairwise different', () => {
  for (const p of ALL) {
    assert.equal(p.colors.length, 5, p.name);
    for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/, `${p.name}: ${c}`);
    assert.equal(new Set(p.colors).size, 5, p.name);
  }
});

test('paper and soft chips are distinguishable', () => {
  for (const p of ALL) {
    const r = contrastRatio(p.colors[0]!, p.colors[4]!);
    assert.ok(r >= 1.1, `${p.name}: ${r}`);
  }
});

test('paletteRoles takes paper as background and ink as text, at 12 or more', () => {
  for (const p of ALL) {
    const r = paletteRoles(p.colors);
    assert.equal(r.background, p.colors[0], p.name);
    assert.equal(r.text, p.colors[1], p.name);
    const ratio = contrastRatio(r.text, r.background);
    assert.ok(ratio >= 12, `${p.name}: ${ratio}`);
  }
});

test('own ground: visible pattern, AAA text on light paper, AA on dark paper', () => {
  for (const p of ALL) {
    const r = paletteRoles(p.colors);
    assert.equal(patternInvisible(r, PICK_OPACITY), false, p.name);
    const w = worstTextContrast(r, PICK_OPACITY);
    assert.ok(w >= (p.dark ? 4.5 : 7), `${p.name}: ${w}`);
  }
});

test('swapped ground: visible pattern and AA text', () => {
  for (const p of ALL) {
    const r = swapRoles(paletteRoles(p.colors));
    assert.equal(patternInvisible(r, PICK_OPACITY), false, p.name);
    const w = worstTextContrast(r, PICK_OPACITY);
    assert.ok(w >= 4.5, `${p.name}: ${w}`);
  }
});

test('a soft fill keeps AAA text and a light accent fill keeps AA', () => {
  for (const p of ALL) {
    const [paper, ink, stroke, accent, soft] = p.colors as [string, string, string, string, string];
    const s = { background: paper, pattern: stroke, patternOpacity: 0.6 };
    const softWorst = worstTextContrastSurfaces(ink, { ...s, fill: soft, fillOpacity: 1 });
    const accentWorst = worstTextContrastSurfaces(ink, { ...s, fill: accent, fillOpacity: 0.25 });
    assert.ok(softWorst >= (p.dark ? 4.5 : 7), `${p.name}: soft ${softWorst.toFixed(2)}`);
    assert.ok(accentWorst >= 4.5, `${p.name}: accent ${accentWorst.toFixed(2)}`);
  }
});

test('OKLCH rules: in gamut, no dark yellow, saturated figure on a calm ground, close stroke and soft', () => {
  for (const s of ALL_SPECS) {
    const lch = paletteLch(s);
    const [paper, , stroke, accent, soft] = lch;
    const name = `${s.name} hue ${s.hue}`;
    for (const [l, c, h] of lch) assert.ok(inGamut(l, c, h), `${name}: ${l} ${c} ${h}`);
    for (const [l, , h] of [stroke, accent]) assert.ok(!(h >= 60 && h <= 115 && l < 0.7), `${name}: L ${l} h ${h}`);
    assert.ok(paper[1] <= 0.02 && soft[1] <= 0.05, name);
    assert.ok(accent[1] >= 1.5 * paper[1], `${name}: accent C ${accent[1]}`);
    assert.ok(hueDist(stroke[2], soft[2]) <= 20, name);
  }
});

test('random palettes are deterministic for a seed', () => {
  const draw = (seed: number) =>
    Array.from(
      { length: 20 },
      (
        (r) => () =>
          makePalette(randomPaletteSpec(r))
      )(mulberry32(seed)),
    );
  assert.deepEqual(draw(7), draw(7));
  assert.notDeepEqual(draw(7), draw(8));
  assert.equal(makePalette(randomPaletteSpec(mulberry32(1))).name, 'Random');
});

test('makePalette is deterministic and PALETTES follow PALETTE_SPECS', () => {
  PALETTE_SPECS.forEach((s, i) => assert.deepEqual(PALETTES[i], makePalette(s), s.name));
});

test('every palette is in exactly one group, and the groups hold no unknown name', () => {
  const grouped = PALETTE_GROUPS.flatMap((g) => g.palettes.map((p) => p.name));
  assert.deepEqual([...grouped].sort(), PALETTES.map((p) => p.name).sort());
});
