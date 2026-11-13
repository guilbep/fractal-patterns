import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../patterns/util.ts';
import { PALETTES, rollPalette } from '../palettes.ts';
import { compose, THEMES, themeFamilies } from './compose.ts';
import { studioSvg } from './model.ts';
import { MOTIF_FAMILIES } from './motifs.ts';
import { DEFAULT_DESIGN, decodeStudio, designOptions, encodeStudio, MAX_SEED, REPEATS, type StudioDesign } from './studio-share.ts';

test('50 seeded random designs survive a round trip', () => {
  const rnd = mulberry32(42);
  for (let i = 0; i < 50; i++) {
    const theme = THEMES[i % THEMES.length]!.id;
    const all = themeFamilies(theme).map((f) => f.id);
    let families = all.filter(() => rnd() < 0.5);
    if (families.length === 0) families = [all[i % all.length]!];
    const d: StudioDesign = {
      seed: Math.floor(rnd() * MAX_SEED),
      palette: i % 5 === 0 ? rollPalette(rnd) : PALETTES[Math.floor(rnd() * PALETTES.length)]!,
      repeat: REPEATS[Math.floor(rnd() * REPEATS.length)]!,
      density: Math.round(rnd() * 100) / 100,
      size: 200 + 20 * Math.floor(rnd() * 16),
      stems: rnd() < 0.5,
      theme,
      families,
      large: i % 3 === 0,
      balance: i % 2 === 0,
    };
    assert.deepEqual(decodeStudio(encodeStudio(d)), d);
    assert.deepEqual(decodeStudio(`#${encodeStudio(d)}`), d);
  }
});

test('the defaults encode to ba=1 only, and an empty hash (a fresh page) decodes to them', () => {
  assert.equal(encodeStudio({ ...DEFAULT_DESIGN, families: [...DEFAULT_DESIGN.families] }), 'ba=1');
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
  assert.deepEqual(decodeStudio('s=abc&p=x&r=&d=NaN&z=Infinity&f=zz'), { ...DEFAULT_DESIGN, balance: false });
});

test('out-of-range values are clamped', () => {
  const d = decodeStudio('s=-5&p=999&r=9&d=3&z=9000&f=9999');
  assert.equal(d.seed, 0);
  assert.equal(d.palette.name, 'Lilac'); // old index clamped to 23: Plum, best match Lilac
  assert.equal(d.repeat, 'mirror');
  assert.equal(d.density, 1);
  assert.equal(d.size, 500);
  assert.deepEqual(d.families, [...MOTIF_FAMILIES]);
  const e = decodeStudio('s=99999999999&p=-1&r=-1&d=-1&z=1&f=-3');
  assert.equal(e.seed, MAX_SEED);
  assert.equal(e.palette.name, 'Brick'); // old index clamped to 0: Brick
  assert.equal(e.repeat, 'straight');
  assert.equal(e.density, 0);
  assert.equal(e.size, 200);
  assert.equal(decodeStudio('z=311').size, 320);
});

test('the page default is light: its SVG is under 20000 bytes', () => {
  const bytes = new TextEncoder().encode(studioSvg(compose(designOptions(DEFAULT_DESIGN)))).length;
  assert.ok(bytes < 20000, `${bytes} bytes`);
});

test('theme: round trip, absent is floral, unknown falls back to floral, old links unchanged', () => {
  for (const { id } of THEMES) {
    const d: StudioDesign = { ...DEFAULT_DESIGN, theme: id, families: themeFamilies(id).map((f) => f.id) };
    assert.deepEqual(decodeStudio(encodeStudio(d)), d, id);
    // Bit i is the theme's i-th family.
    const two = { ...d, families: [d.families[0]!, d.families[2]!] };
    assert.ok(encodeStudio(two).includes('f=5'), id);
    assert.deepEqual(decodeStudio(encodeStudio(two)), two, id);
  }
  assert.equal(encodeStudio({ ...DEFAULT_DESIGN, theme: 'sea', families: themeFamilies('sea').map((f) => f.id) }), 't=s&ba=1');
  assert.equal(decodeStudio('s=3').theme, 'floral');
  assert.equal(decodeStudio('t=o&f=1').families.join(), 'pear');
  for (const h of ['t=x', 't=', 't=floral', 't=S']) assert.deepEqual(decodeStudio(h), { ...DEFAULT_DESIGN, balance: false }, h);
  // An old link decodes as before.
  const old = decodeStudio('s=7&r=1&f=5');
  assert.equal(old.theme, 'floral');
  assert.deepEqual(old.families, [MOTIF_FAMILIES[0], MOTIF_FAMILIES[2]]);
  assert.equal(encodeStudio(old), 's=7&r=1&f=5&ba=0');
  // Only the theme changed: a different string.
  const base = decodeStudio('s=7&f=5');
  assert.notEqual(encodeStudio({ ...base, theme: 'orchard' }), encodeStudio(base));
});

test('palette: round trip by name, random through pc, old p index, unknown name, never p=', () => {
  for (const p of PALETTES) {
    const d = { ...DEFAULT_DESIGN, palette: p };
    const h = encodeStudio(d);
    assert.ok(p === DEFAULT_DESIGN.palette ? h === 'ba=1' : h === `pn=${encodeURIComponent(p.name).replace(/%20/g, '+')}&ba=1`, h);
    assert.deepEqual(decodeStudio(h).palette, p);
  }
  const rnd = mulberry32(7);
  for (let i = 0; i < 20; i++) {
    const r = rollPalette(rnd);
    const h = encodeStudio({ ...DEFAULT_DESIGN, palette: r });
    assert.match(h, /^pc=[0-9a-f]{6}(\.[0-9a-f]{6}){4}&ba=1$/);
    assert.deepEqual(decodeStudio(h).palette, r);
    assert.ok(!/(^|&)p=/.test(h), h);
  }
  // Old links: p indexed six hues by four schemes, mapped to the nearest palette by base hue.
  const old = ['Brick', 'Clay', 'Fern', 'Lagoon', 'Slate', 'Lilac'];
  for (let i = 0; i < 24; i++) assert.equal(decodeStudio(`p=${i}`).palette.name, old[Math.floor(i / 4)], String(i));
  assert.equal(decodeStudio('pn=Nope').palette, DEFAULT_DESIGN.palette);
  assert.equal(decodeStudio('pc=12.34').palette, DEFAULT_DESIGN.palette);
  assert.equal(decodeStudio('pn=Plum&pc=000000.111111.222222.333333.444444&p=0').palette.name, 'Plum');
  assert.equal(decodeStudio('pn=Nope&pc=000000.111111.222222.333333.444444').palette.colors[4], '#444444');
});

test('large tile: lg=1 only when on, written last, round trip; old links decode to off; doubles the compose size', () => {
  const d: StudioDesign = { ...DEFAULT_DESIGN, families: [...DEFAULT_DESIGN.families], seed: 7, large: true };
  const h = encodeStudio(d);
  assert.ok(h.endsWith('lg=1&ba=1'), h);
  assert.deepEqual(decodeStudio(h), d);
  assert.ok(!encodeStudio({ ...d, large: false }).includes('lg'));
  assert.equal(decodeStudio('s=7&r=1&d=0.6').large, false);
  const o = designOptions(d);
  assert.deepEqual([o.width, o.height, o.span], [2 * d.size, 2 * d.size, 2]);
  assert.equal('span' in designOptions({ ...d, large: false }), false);
});

test('balance: ba=1 and ba=0 round trip, a link without ba (made before the key) is off, a fresh page is on', () => {
  for (const balance of [true, false]) {
    const d: StudioDesign = { ...DEFAULT_DESIGN, seed: 9, balance };
    const h = encodeStudio(d);
    assert.ok(h.endsWith(`ba=${balance ? 1 : 0}`), h);
    assert.deepEqual(decodeStudio(h), d);
    assert.equal(designOptions(d).balance, balance);
  }
  assert.equal(decodeStudio('s=9&r=3').balance, false);
  assert.equal(decodeStudio('lg=1').balance, false);
  assert.equal(decodeStudio('').balance, true);
  assert.equal(decodeStudio('#').balance, true);
  assert.equal(DEFAULT_DESIGN.balance, true);
});
