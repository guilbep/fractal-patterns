import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRAIN_DEFAULTS, GRAIN_TILE, grainColor, grainSvg } from './grain.ts';
import { blend, contrastRatio } from './contrast.ts';
import { textWorst } from './pairing.ts';
import { DESIGN_DEFAULTS, decodeDesign, encodeDesign } from './share.ts';

test('grainSvg: stitched fractal noise over its own tile, the peak opacity is the amount', () => {
  const s = grainSvg({ ...GRAIN_DEFAULTS, on: true, amount: 12 });
  assert.ok(s.includes('<feTurbulence type="fractalNoise"'));
  assert.ok(s.includes('stitchTiles="stitch"'));
  assert.ok(s.includes(`width="${GRAIN_TILE}" height="${GRAIN_TILE}"`));
  assert.ok(s.includes('x="0" y="0" width="100%" height="100%"')); // the filter region is the tile: no seam
  assert.ok(s.includes('opacity="0.12"'));
  assert.ok(grainSvg({ ...GRAIN_DEFAULTS, size: 0.4 }, 96, 48).includes('width="96" height="48"'));
  assert.ok(s.length < 600, `${s.length}`);
});

test('gr: amount_size_tone, last, only when on; malformed gives off; old links unchanged', () => {
  const on = { on: true, amount: 12, size: 0.75, tone: 'dark' } as const;
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, grain: on }), 'gr=12_0.75_d');
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, grain: { ...on, on: false } }), '');
  assert.ok(encodeDesign({ ...DESIGN_DEFAULTS, kind: 'hex', grain: on }).endsWith('&gr=12_0.75_d'));
  assert.deepEqual(decodeDesign('k=hex&gr=30_1.2_l').grain, { on: true, amount: 30, size: 1.2, tone: 'light' });
  assert.deepEqual(decodeDesign('gr=99_9_d').grain, { on: true, amount: 30, size: 1.2, tone: 'dark' }); // clamped
  for (const bad of ['', '12_0.75', '12_0.75_x', 'a_0.75_d', '12__d', '12_0.75_d_1'])
    assert.deepEqual(decodeDesign(`gr=${bad}`).grain, GRAIN_DEFAULTS, bad);
  for (const old of [
    'k=hex&s=1',
    'k=truchet&s=2692185587&d=4&z=96&w=5&bg=f4e9d8&fg=2f6f62&tx=1e2747&o=1&pm=plate&po=0.88&pr=10',
    'k=fern&fi=c_abcdef_0.5&am=0.42.-10',
  ]) {
    assert.equal(decodeDesign(old).grain.on, false, old);
    assert.ok(!encodeDesign(decodeDesign(old)).includes('gr='), old);
  }
});

test('contrast: the grained background is one more surface under the text', () => {
  const roles = { background: '#ffffff', pattern: '#ffffff', text: '#000000' };
  const grained = blend(grainColor('dark'), '#ffffff', 0.2);
  assert.equal(grained, '#cccccc');
  assert.equal(textWorst(roles, 0.6, 0), 21);
  assert.equal(textWorst({ ...roles, grain: { color: '#000000', opacity: 0.2 } }, 0.6, 0), contrastRatio('#000000', grained));
});
