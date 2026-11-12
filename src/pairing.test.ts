import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES } from './palettes.ts';
import { PATTERN_VISIBLE_MIN, fixContrast, patternContrast, patternInvisible, pickRoles, swapRoles, worstTextContrast, type Roles } from './pairing.ts';

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
