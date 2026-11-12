import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../patterns/util.ts';
import { PALETTES } from '../palettes.ts';
import { compose } from './compose.ts';
import { studioSvg } from './model.ts';
import { MOTIF_FAMILIES } from './motifs.ts';
import { DEFAULT_DESIGN, decodeStudio, designOptions, encodeStudio, MAX_SEED, REPEATS, type StudioDesign } from './studio-share.ts';

test('50 seeded random designs survive a round trip', () => {
  const rnd = mulberry32(42);
  for (let i = 0; i < 50; i++) {
    let families = MOTIF_FAMILIES.filter(() => rnd() < 0.5);
    if (families.length === 0) families = [MOTIF_FAMILIES[i % MOTIF_FAMILIES.length]!];
    const d: StudioDesign = {
      seed: Math.floor(rnd() * MAX_SEED),
      palette: Math.floor(rnd() * PALETTES.length),
      repeat: REPEATS[Math.floor(rnd() * REPEATS.length)]!,
      density: Math.round(rnd() * 100) / 100,
      size: 200 + 20 * Math.floor(rnd() * 16),
      stems: rnd() < 0.5,
      families,
    };
    assert.deepEqual(decodeStudio(encodeStudio(d)), d);
    assert.deepEqual(decodeStudio(`#${encodeStudio(d)}`), d);
  }
});

test('the defaults encode to an empty string and decode from one', () => {
  assert.equal(encodeStudio({ ...DEFAULT_DESIGN, families: [...DEFAULT_DESIGN.families] }), '');
  assert.deepEqual(decodeStudio(''), DEFAULT_DESIGN);
  assert.deepEqual(decodeStudio('#'), DEFAULT_DESIGN);
});

test('malformed input gives the defaults', () => {
  for (const h of ['s=abc&p=x&r=&d=NaN&z=Infinity&st&f=zz', '%%%&==&s', 'garbage', 'f=0', 's=1e999']) {
    const d = decodeStudio(h);
    assert.equal(d.palette, DEFAULT_DESIGN.palette, h);
    assert.equal(d.repeat, DEFAULT_DESIGN.repeat, h);
    assert.equal(d.density, DEFAULT_DESIGN.density, h);
    assert.equal(d.size, DEFAULT_DESIGN.size, h);
    assert.deepEqual(d.families, DEFAULT_DESIGN.families, h);
  }
  assert.deepEqual(decodeStudio('s=abc&p=x&r=&d=NaN&z=Infinity&f=zz'), DEFAULT_DESIGN);
});

test('out-of-range values are clamped', () => {
  const d = decodeStudio('s=-5&p=999&r=9&d=3&z=9000&f=9999');
  assert.equal(d.seed, 0);
  assert.equal(d.palette, PALETTES.length - 1);
  assert.equal(d.repeat, 'mirror');
  assert.equal(d.density, 1);
  assert.equal(d.size, 500);
  assert.deepEqual(d.families, [...MOTIF_FAMILIES]);
  const e = decodeStudio('s=99999999999&p=-1&r=-1&d=-1&z=1&f=-3');
  assert.equal(e.seed, MAX_SEED);
  assert.equal(e.palette, 0);
  assert.equal(e.repeat, 'straight');
  assert.equal(e.density, 0);
  assert.equal(e.size, 200);
  assert.equal(decodeStudio('z=311').size, 320);
});

test('the page default is light: its SVG is under 20000 bytes', () => {
  const bytes = new TextEncoder().encode(studioSvg(compose(designOptions(DEFAULT_DESIGN)))).length;
  assert.ok(bytes < 20000, `${bytes} bytes`);
});
