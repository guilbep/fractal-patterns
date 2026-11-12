import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES } from './palettes.ts';
import { contrastRatio, relativeLuminance } from './contrast.ts';
import { PATTERN_VISIBLE_MIN, PICK_OPACITY, fixContrast, fixSplit, fixWithPlate, largeTarget,patternContrast, patternInvisible, pickRoles, plateContrast, swapRoles, worstTextContrast, type Roles } from './pairing.ts';

const OPACITIES = [0.1, 0.4, 1];

function* cases(): Generator<[string, Roles, number]> {
  for (const p of PALETTES) {
    const roles = pickRoles(p.colors);
    for (const [variant, r] of [['light', roles], ['dark', swapRoles(roles)]] as const) {
      for (const o of OPACITIES) yield [`${p.name} (${variant}, opacity ${o})`, r, o];
    }
  }
}

test('fixContrast reaches 4.5 for every palette, both variants', () => {
  for (const [name, r, o] of cases()) {
    const f = fixContrast(r, o);
    assert.equal(f.reached, true, name);
    assert.ok(f.ratio >= 4.5, `${name}: ratio ${f.ratio}`);
    assert.ok(f.opacity <= o, `${name}: opacity ${f.opacity}`);
    const recomputed = worstTextContrast({ ...r, text: f.text }, f.opacity);
    assert.ok(Math.abs(f.ratio - recomputed) < 1e-9, `${name}: ratio ${f.ratio} vs ${recomputed}`);
  }
});

test('fixContrast at target 7 never claims reached below 7', () => {
  for (const [name, r, o] of cases()) {
    const f = fixContrast(r, o, 7);
    if (f.reached) assert.ok(f.ratio >= 7, `${name}: reached with ratio ${f.ratio}`);
    else assert.ok(f.ratio < 7, `${name}: not reached with ratio ${f.ratio}`);
  }
});

test('fixContrast leaves a passing combination unchanged', () => {
  const f = fixContrast({ background: '#ffffff', pattern: '#000000', text: '#000000' }, 0.05);
  assert.equal(f.text, '#000000');
  assert.equal(f.opacity, 0.05);
  assert.equal(f.reached, true);
});

test('fixContrast lowers opacity when no text fits both surfaces', () => {
  const f = fixContrast({ background: '#ffffff', pattern: '#333333', text: '#777777' }, 1);
  assert.equal(f.reached, true);
  assert.ok(f.ratio >= 4.5);
  assert.ok(f.opacity < 1, `opacity ${f.opacity}`);
});

test('fixContrast keeps opacity when a text change is enough', () => {
  const f = fixContrast({ background: '#ffffff', pattern: '#000000', text: '#777777' }, 1);
  assert.equal(f.reached, true);
  assert.ok(f.ratio >= 4.5);
  assert.equal(f.opacity, 1);
});

test('worstTextContrast takes the worse surface', () => {
  const r = { background: '#ffffff', pattern: '#000000', text: '#000000' };
  assert.ok(Math.abs(worstTextContrast(r, 1) - 1) < 1e-9);
  assert.ok(Math.abs(worstTextContrast(r, 0) - 21) < 1e-9);
});

test('pickRoles', () => {
  assert.deepEqual(pickRoles(['#ffffff', '#000000', '#eeeeee']), {
    background: '#ffffff',
    text: '#000000',
    pattern: '#eeeeee',
  });
  const two = pickRoles(['#000000', '#ffffff']);
  assert.equal(two.pattern, two.text);
  assert.throws(() => pickRoles(['#000000']));
});

test('swapRoles swaps background and text, keeps pattern', () => {
  assert.deepEqual(swapRoles({ background: '#ffffff', pattern: '#888888', text: '#000000' }), {
    background: '#000000',
    pattern: '#888888',
    text: '#ffffff',
  });
});

test('patternContrast at opacity 0 is 1', () => {
  assert.equal(patternContrast({ background: '#123456', pattern: '#fedcba', text: '#000000' }, 0), 1);
});

test('patternInvisible flags a pattern below PATTERN_VISIBLE_MIN', () => {
  const r = (background: string, pattern: string): Roles => ({ background, pattern, text: '#000000' });
  assert.equal(patternInvisible(r('#ffffff', '#eeeeee'), 1), true); // ~1.16
  assert.equal(patternInvisible(r('#ffffff', '#cccccc'), 1), false); // ~1.61
  assert.equal(patternInvisible(r('#ffffff', '#000000'), 1), false); // 21
  assert.equal(patternInvisible(r('#ffffff', '#000000'), 0.05), true); // ~1.12
  assert.equal(patternInvisible(r('#12232e', '#12232e'), 1), true); // 1
  assert.equal(PATTERN_VISIBLE_MIN, 1.2);
});

const A: Roles = { background: '#ffffff', pattern: '#000000', text: '#000000' };
const B: Roles = { background: '#ffffff', pattern: '#333333', text: '#777777' };
const C: Roles = { background: '#12232e', pattern: '#4da8da', text: '#eefbfb' };
const near = (actual: number, expected: number, msg?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, msg ?? `${actual} vs ${expected}`);

test('plateContrast vectors', () => {
  near(plateContrast(A, 1, 0.85), 14.877435225839799);
  near(plateContrast(A, 1, 0), 1);
  near(plateContrast(A, 1, 1), 21);
  assert.equal(plateContrast(A, 1, 2), plateContrast(A, 1, 1));
  near(plateContrast(C, 0.6, 0), 4.910599091568643);
  near(plateContrast(C, 0.6, 0.85), 13.126997604344183);
});

test('plateContrast at plate 0 equals worstTextContrast', () => {
  for (const r of [A, B, C]) assert.equal(plateContrast(r, 0.6, 0), worstTextContrast(r, 0.6));
});

test('fixWithPlate raises the plate to the first passing step', () => {
  const f = fixWithPlate(A, 1, 0);
  assert.equal(f.text, '#000000');
  assert.equal(f.plate, 0.5);
  near(f.ratio, 5.317210002277984);
  assert.equal(f.reached, true);
  const g = fixWithPlate(A, 1, 0, 7);
  assert.equal(g.text, '#000000');
  assert.equal(g.plate, 0.6);
  near(g.ratio, 7.3709355625018365);
  assert.equal(g.reached, true);
});

test('fixWithPlate changes the text when plate 1 still fails', () => {
  const f = fixWithPlate(B, 1, 0.5);
  assert.equal(f.text, '#767676');
  assert.equal(f.plate, 1);
  near(f.ratio, 4.542224959605253);
  assert.equal(f.reached, true);
});

test('fixWithPlate leaves a passing combination unchanged', () => {
  const f = fixWithPlate(C, 0.6, 0.85);
  assert.equal(f.text, '#eefbfb');
  assert.equal(f.plate, 0.85);
  assert.equal(f.reached, true);
});

test('fixWithPlate reaches 4.5 for every palette', () => {
  for (const p of PALETTES) {
    const r = pickRoles(p.colors);
    const f = fixWithPlate(r, 1, 0);
    assert.equal(f.reached, true, p.name);
    assert.ok(f.ratio >= 4.5, `${p.name}: ratio ${f.ratio}`);
    assert.ok(f.plate >= 0 && f.plate <= 1, `${p.name}: plate ${f.plate}`);
    near(f.ratio, plateContrast({ ...r, text: f.text }, 1, f.plate), p.name);
  }
});

const others = (colors: readonly string[], r: Roles) => colors.filter((c) => c !== r.background && c !== r.text);
const visibleAt = (r: Roles, c: string) => patternContrast({ ...r, pattern: c }, 0.6) >= 1.2;
const readableAt = (r: Roles, c: string) => worstTextContrast({ ...r, pattern: c }, 0.6) >= 4.5;

test('pickRoles picks a visible pattern when the palette has one', () => {
  for (const p of PALETTES) {
    const r = pickRoles(p.colors);
    if (others(p.colors, r).some((c) => visibleAt(r, c))) {
      assert.equal(patternInvisible(r, 0.6), false, `${p.name}: pattern ${r.pattern}`);
    }
  }
});

test('pickRoles prefers a visible pattern that keeps the text at AA', () => {
  for (const p of PALETTES) {
    const r = pickRoles(p.colors);
    if (others(p.colors, r).some((c) => visibleAt(r, c) && readableAt(r, c))) {
      assert.ok(visibleAt(r, r.pattern) && readableAt(r, r.pattern), `${p.name}: pattern ${r.pattern}`);
    }
  }
});

test('pickRoles keeps the highest-contrast pair as background and text', () => {
  for (const p of PALETTES) {
    const r = pickRoles(p.colors);
    let max = -1;
    for (const a of p.colors) for (const b of p.colors) max = Math.max(max, contrastRatio(a, b));
    assert.equal(contrastRatio(r.background, r.text), max, p.name);
    assert.ok(relativeLuminance(r.background) >= relativeLuminance(r.text), p.name);
  }
});

test('pickRoles leaves at most 3 palettes with an invisible pattern', () => {
  const invisible = PALETTES.filter((p) => patternInvisible(pickRoles(p.colors), 0.6)).map((p) => p.name);
  assert.ok(invisible.length <= 3, invisible.join(', '));
});

test('PICK_OPACITY and largeTarget', () => {
  assert.equal(PICK_OPACITY, 0.6);
  assert.equal(largeTarget(4.5), 3);
  assert.equal(largeTarget(7), 4.5);
  assert.equal(largeTarget(3), 3);
});

test('fixSplit leaves a passing combination unchanged', () => {
  const f = fixSplit({ background: '#ffffff', pattern: '#dddddd', text: '#000000' }, 0.6, 0.85);
  assert.equal(f.text, '#000000');
  assert.equal(f.plate, 0.85);
  assert.equal(f.opacity, 0.6);
  assert.equal(f.reached, true);
});

test('fixSplit reaches both thresholds for every palette, both variants', () => {
  for (const p of PALETTES) {
    const roles = pickRoles(p.colors);
    for (const [variant, r] of [['light', roles], ['dark', swapRoles(roles)]] as const) {
      const name = `${p.name} (${variant})`;
      const f = fixSplit(r, 1, 0);
      assert.equal(f.reached, true, name);
      assert.ok(f.paragraph >= 4.5, `${name}: paragraph ${f.paragraph}`);
      assert.ok(f.heading >= 3, `${name}: heading ${f.heading}`);
      assert.ok(f.opacity <= 1 && f.plate >= 0, `${name}: opacity ${f.opacity}, plate ${f.plate}`);
      const t = { ...r, text: f.text };
      assert.ok(Math.abs(f.paragraph - plateContrast(t, f.opacity, f.plate)) < 1e-9, name);
      assert.ok(Math.abs(f.heading - worstTextContrast(t, f.opacity)) < 1e-9, name);
    }
  }
});

test('fixSplit at target 7 never claims reached with a failing value', () => {
  for (const p of PALETTES) {
    const f = fixSplit(pickRoles(p.colors), 1, 0, 7);
    if (f.reached) assert.ok(f.paragraph >= 7 && f.heading >= 4.5, `${p.name}: ${f.paragraph}, ${f.heading}`);
  }
});

const assertSplitReached = (r: Roles, name: string) => {
  const f = fixSplit(r, 1, 0);
  assert.equal(f.reached, true, name);
  assert.ok(f.paragraph >= 4.5 && f.heading >= 3, `${name}: paragraph ${f.paragraph}, heading ${f.heading}`);
};

test('fixSplit does not flip the text between heading and paragraph (named palettes)', () => {
  for (const [name, swap] of [["Purple 90's", true], ['Photographic Memory', true], ['Stark Contrast', false]] as const) {
    const p = PALETTES.find((q) => q.name === name);
    if (!p) continue; // the palette list may change later
    const roles = pickRoles(p.colors);
    assertSplitReached(swap ? swapRoles(roles) : roles, name);
  }
});

test('fixSplit does not flip the text between heading and paragraph (literal roles)', () => {
  assertSplitReached({ background: '#8458b3', pattern: '#d0bdf4', text: '#e5eaf5' }, 'literal');
});

test('fixSplit fixes a heading that fails on the bare pattern', () => {
  const r = { background: '#ffffff', pattern: '#000000', text: '#000000' };
  const f = fixSplit(r, 1, 1);
  assert.equal(f.reached, true);
  assert.ok(f.heading >= 3, `heading ${f.heading}`);
  assert.ok(f.opacity < 1 || f.text !== r.text, `opacity ${f.opacity}, text ${f.text}`);
});
