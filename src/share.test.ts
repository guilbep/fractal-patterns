import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, MAX_DEPTH } from './fractal.ts';
import { createHistory } from './history.ts';
import { LAYER2_DEFAULTS } from './layers.ts';
import { VARIANT_DEFAULTS, type VariantOptions } from './variants.ts';
import { DESIGN_DEFAULTS, decodeDesign, encodeDesign, sameDesign, type Design } from './share.ts';

// Small seeded generator (mulberry32), so failures reproduce.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDesign(r: () => number): Design {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  const real = (lo: number, hi: number) => Math.round((lo + r() * (hi - lo)) * 100) / 100 + 0;
  const color = () => `#${int(0, 0xffffff).toString(16).padStart(6, '0')}`;
  const kind = pick(KINDS);
  return {
    kind,
    seed: int(0, 0xffffffff),
    depth: int(1, MAX_DEPTH[kind]),
    size: real(40, 240),
    strokeWidth: real(0.5, 6),
    precision: int(0, 3),
    background: color(),
    pattern: color(),
    text: color(),
    opacity: real(0, 1),
    plateMode: pick(['plate', 'split', 'direct'] as const),
    plateOpacity: real(0, 1),
    plateRadius: real(0, 32),
    plateBlur: real(0, 12),
    rotate: real(-180, 180),
    scale: real(0.5, 3),
    skew: real(-45, 45),
    tilt: real(0, 60),
    drift: pick(['none', 'x', 'y', 'xy'] as const),
    speed: real(2, 30),
    zoom: real(0.25, 4),
    gap: real(0, 120),
    mirror: r() < 0.5,
    layout: pick(['single', 'patchwork'] as const),
    cells: int(2, 4),
    frame: r() < 0.5,
    families: int(1, 63),
    variants: r() < 0.5,
    layer2: r() < 0.5,
    fade: r() < 0.5,
    layer2Settings:
      r() < 0.5
        ? LAYER2_DEFAULTS
        : { x: int(0, 100), y: int(0, 100), rotate: int(-180, 180), scale: real(0.5, 3), opacity: real(0.1, 1), depth: real(0.25, 4) },
    parallax: r() < 0.5,
    variantOptions: r() < 0.5 ? VARIANT_DEFAULTS : randomVO(r),
    sections: r() < 0.5,
    fill: r() < 0.5 ? DESIGN_DEFAULTS.fill : { mode: pick(['closed', 'alternate'] as const), color: color(), opacity: real(0, 1) },
  };
}

function randomVO(r: () => number): VariantOptions {
  const [cells, count] = (
    [
      [2, 2],
      [4, 4],
      [6, 4],
      [6, 6],
    ] as const
  )[Math.floor(r() * 4)]!;
  const pct = (hi: number) => Math.round(r() * hi) / 100;
  return {
    cells,
    count,
    orient: r() < 0.5,
    drop: (['none', 'half-drop', 'brick'] as const)[Math.floor(r() * 3)]!,
    depths: r() < 0.5,
    jitter: pct(100),
    weights: pct(100),
    skip: pct(50),
  };
}

// Every field non-default, with values the sliders produce (whole or half steps).
// ponytail: the worst case (longest kind, max seed, x.5 everywhere) encodes to 210 characters (184 before the patchwork keys).
const FULL: Design = {
  kind: 'koch',
  seed: 123456789,
  depth: 3,
  size: 160,
  strokeWidth: 1.5,
  precision: 2,
  background: '#0a0b0c',
  pattern: '#d0e0f0',
  text: '#fedcba',
  opacity: 0.45,
  plateMode: 'plate',
  plateOpacity: 0.9,
  plateRadius: 16,
  plateBlur: 4,
  rotate: -30,
  scale: 1.5,
  skew: 10,
  tilt: 20,
  drift: 'xy',
  speed: 12,
  zoom: 2,
  gap: 24,
  mirror: true,
  layout: 'patchwork',
  cells: 2,
  frame: true,
  families: 5,
  variants: true,
  layer2: true,
  fade: true,
  layer2Settings: { x: 100, y: 100, rotate: -180, scale: 2.95, opacity: 0.55, depth: 3.85 }, // the longest the sliders give
  parallax: true,
  variantOptions: { cells: 6, count: 6, orient: true, drop: 'half-drop', depths: true, jitter: 0.55, weights: 0.55, skip: 0.45 }, // the longest the sliders give
  sections: true,
  fill: { mode: 'alternate', color: '#c3eaec', opacity: 0.55 }, // the longest the slider gives
};

function assertValid(d: Design, label: string): void {
  assert.deepEqual(Object.keys(d), Object.keys(DESIGN_DEFAULTS), label);
  const inRange = (x: number, lo: number, hi: number) => Number.isFinite(x) && x >= lo && x <= hi;
  assert.ok(KINDS.includes(d.kind), label);
  assert.ok(Number.isInteger(d.seed) && inRange(d.seed, 0, 0xffffffff), label);
  assert.ok(Number.isInteger(d.depth) && inRange(d.depth, 1, MAX_DEPTH[d.kind]), label);
  assert.ok(inRange(d.size, 40, 240), label);
  assert.ok(inRange(d.strokeWidth, 0.5, 6), label);
  assert.ok(Number.isInteger(d.precision) && inRange(d.precision, 0, 3), label);
  for (const c of [d.background, d.pattern, d.text]) assert.match(c, /^#[0-9a-f]{6}$/, label);
  assert.ok(inRange(d.opacity, 0, 1), label);
  assert.ok(['plate', 'split', 'direct'].includes(d.plateMode), label);
  assert.ok(inRange(d.plateOpacity, 0, 1), label);
  assert.ok(inRange(d.plateRadius, 0, 32), label);
  assert.ok(inRange(d.plateBlur, 0, 12), label);
  assert.ok(inRange(d.rotate, -180, 180), label);
  assert.ok(inRange(d.scale, 0.5, 3), label);
  assert.ok(inRange(d.skew, -45, 45), label);
  assert.ok(inRange(d.tilt, 0, 60), label);
  assert.ok(['none', 'x', 'y', 'xy'].includes(d.drift), label);
  assert.ok(inRange(d.speed, 2, 30), label);
  assert.ok(inRange(d.zoom, 0.25, 4), label);
  assert.ok(inRange(d.gap, 0, 120), label);
  assert.equal(typeof d.mirror, 'boolean', label);
  assert.ok(['single', 'patchwork'].includes(d.layout), label);
  assert.ok(Number.isInteger(d.cells) && inRange(d.cells, 2, 4), label);
  assert.equal(typeof d.frame, 'boolean', label);
  assert.ok(Number.isInteger(d.families) && inRange(d.families, 1, 63), label);
  assert.equal(typeof d.variants, 'boolean', label);
  assert.equal(typeof d.layer2, 'boolean', label);
  assert.equal(typeof d.fade, 'boolean', label);
  const l = d.layer2Settings;
  assert.ok(inRange(l.x, 0, 100) && inRange(l.y, 0, 100) && inRange(l.rotate, -180, 180), label);
  assert.ok(inRange(l.scale, 0.5, 3) && inRange(l.opacity, 0.1, 1) && inRange(l.depth, 0.25, 4), label);
}

test('defaults encode to the empty string and decode back', () => {
  assert.equal(encodeDesign(DESIGN_DEFAULTS), '');
  for (const q of ['', '?', '#']) assert.deepEqual(decodeDesign(q), DESIGN_DEFAULTS, q);
});

test('round trip of 200 random designs', () => {
  const r = rng(42);
  for (let n = 0; n < 200; n++) {
    const d = randomDesign(r);
    assert.deepEqual(decodeDesign(encodeDesign(d)), d, encodeDesign(d));
  }
});

test('encoding is stable and one field changes the string', () => {
  assert.equal(encodeDesign(FULL), encodeDesign({ ...FULL }));
  const r = rng(7);
  for (let n = 0; n < 50; n++) {
    const a = randomDesign(r);
    const b = randomDesign(r);
    for (const f of Object.keys(a) as (keyof Design)[]) {
      if (f === 'depth' && b.depth > MAX_DEPTH[a.kind]) continue;
      if (f === 'kind' && a.depth > MAX_DEPTH[b.kind]) continue;
      const c = { ...a, [f]: b[f] } as Design;
      assert.equal(encodeDesign(c) === encodeDesign(a), sameDesign(c, a), f);
    }
  }
  assert.notEqual(encodeDesign({ ...FULL, mirror: false }), encodeDesign(FULL));
});

test('a design with every field non-default stays short', () => {
  for (const f of Object.keys(DESIGN_DEFAULTS) as (keyof Design)[]) assert.notEqual(FULL[f], DESIGN_DEFAULTS[f], f);
  const s = encodeDesign(FULL);
  // 177 before the variants key, + '&v=1', + '&l2=1&fd=1', + '&l2s=100_100_-180_2.95_0.55_3.85' (32), + '&px=1' (5),
  // + '&vo=6_6_1_h_1_0.55_0.55_0.45' (28), + '&sx=1' (5), + '&fi=a_c3eaec_0.55' (17)
  assert.ok(s.length <= 281, `${s.length}`);
  assert.deepEqual(decodeDesign(s), FULL);
});

test('hostile input never throws and gives a valid design', () => {
  const r = rng(99);
  const bytes = String.fromCharCode(...Array.from({ length: 10000 }, () => Math.floor(r() * 256)));
  const cases = [
    '%',
    'k=__proto__',
    'k=constructor&s=-1',
    's=1e99',
    's=abc',
    'd=999',
    'bg=zzzzzz',
    'bg=fff',
    'o=5',
    'o=-3',
    bytes,
    's=5&s=6',
  ];
  for (const q of cases) assertValid(decodeDesign(q), q.slice(0, 40));
  assert.equal(decodeDesign('k=__proto__').kind, DESIGN_DEFAULTS.kind);
  assert.equal(decodeDesign('k=constructor&s=-1').seed, 0);
  assert.equal(decodeDesign('s=1e99').seed, 0xffffffff);
  assert.equal(decodeDesign('s=abc').seed, DESIGN_DEFAULTS.seed);
  assert.equal(decodeDesign('s=Infinity').seed, DESIGN_DEFAULTS.seed);
  assert.equal(decodeDesign('s=NaN').seed, DESIGN_DEFAULTS.seed);
  assert.equal(decodeDesign('d=999').depth, MAX_DEPTH[DESIGN_DEFAULTS.kind]);
  assert.equal(decodeDesign('bg=zzzzzz').background, DESIGN_DEFAULTS.background);
  assert.equal(decodeDesign('bg=fff').background, DESIGN_DEFAULTS.background); // 3 digits is not accepted
  assert.equal(decodeDesign('o=5').opacity, 1);
  assert.equal(decodeDesign('o=-3').opacity, 0);
  assert.equal(decodeDesign('s=5&s=6').seed, 5); // a repeated key: the first value wins
});

test('depth is clamped to the max depth of the decoded kind', () => {
  assert.equal(decodeDesign('k=carpet&d=9').depth, MAX_DEPTH.carpet);
  assert.equal(decodeDesign('k=carpet').depth, MAX_DEPTH.carpet);
});

test('colors are case-insensitive on input, lower-case on output', () => {
  assert.equal(decodeDesign('bg=AABBCC').background, '#aabbcc');
  assert.equal(decodeDesign('fg=AaBbCc').pattern, '#aabbcc');
});

test('no __proto__ or constructor key on the result', () => {
  for (const q of ['__proto__=1', 'constructor=1', 'k=__proto__&__proto__[x]=1']) {
    const d = decodeDesign(q);
    assert.deepEqual(Object.keys(d), Object.keys(DESIGN_DEFAULTS));
    assert.equal(Object.getPrototypeOf(d), Object.prototype);
  }
});

test('sameDesign compares field by field', () => {
  assert.equal(sameDesign(FULL, { ...FULL }), true);
  assert.equal(sameDesign(FULL, { ...FULL, gap: 0 }), false);
});

test('round trip of 100 random patchwork designs', () => {
  const r = rng(5);
  for (let n = 0; n < 100; n++) {
    const d: Design = { ...randomDesign(r), layout: 'patchwork' };
    assert.deepEqual(decodeDesign(encodeDesign(d)), d, encodeDesign(d));
  }
});

test('hostile patchwork values fall back or clamp', () => {
  for (const q of ['c=99', 'c=abc', 'fa=0', 'fa=999', 'fa=-4', 'l=x', 'f=yes']) assertValid(decodeDesign(q), q);
  assert.equal(decodeDesign('c=99').cells, 4);
  assert.equal(decodeDesign('c=abc').cells, 3);
  assert.equal(decodeDesign('fa=0').families, DESIGN_DEFAULTS.families);
  assert.equal(decodeDesign('fa=999').families, 63);
  // A link from before the Quasicrystals family keeps its five families: the new family is the next bit.
  assert.equal(decodeDesign('fa=31').families, 31);
  assert.equal(decodeDesign('l=x').layout, 'single');
  assert.equal(decodeDesign('f=yes').frame, false);
  assert.equal(encodeDesign(DESIGN_DEFAULTS), '');
});

test('variants: round trip, absent means false, old links decode as before', () => {
  const d = { ...DESIGN_DEFAULTS, kind: 'brick', seed: 7, variants: true } as const;
  assert.equal(encodeDesign(d), 'k=brick&s=7&v=1');
  assert.deepEqual(decodeDesign(encodeDesign(d)), d);
  assert.equal(decodeDesign('k=brick&s=7').variants, false);
  // Literals taken from encodeDesign before the variants key existed.
  assert.equal(encodeDesign(DESIGN_DEFAULTS), '');
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, kind: 'brick', seed: 7, mirror: true }), 'k=brick&s=7&m=1');
  const old =
    'k=koch&s=123456789&d=3&z=160&w=1.5&p=2&bg=0a0b0c&fg=d0e0f0&tx=fedcba&o=0.45&pm=plate&po=0.9&pr=16&pb=4&r=-30&sc=1.5&sk=10&t=20&dr=xy&sp=12&zm=2&g=24&m=1&l=patchwork&c=2&f=1&fa=5';
  const oldDesign = {
    ...FULL,
    variants: false,
    layer2: false,
    fade: false,
    layer2Settings: LAYER2_DEFAULTS,
    parallax: false,
    variantOptions: VARIANT_DEFAULTS,
    sections: false,
    fill: DESIGN_DEFAULTS.fill,
  };
  assert.deepEqual(decodeDesign(old), oldDesign);
  assert.equal(encodeDesign(oldDesign), old);
});

test('undo restores the previous value of the variants switch', () => {
  const h = createHistory<Design>(DESIGN_DEFAULTS, 50, sameDesign);
  h.push({ ...DESIGN_DEFAULTS, variants: true });
  assert.equal(h.current().variants, true);
  assert.equal(h.undo()?.variants, false);
  assert.equal(h.redo()?.variants, true);
});

test('layer2 and fade: round trip, absent means false, old links decode as before', () => {
  const d = { ...DESIGN_DEFAULTS, kind: 'brick', seed: 7, variants: true, layer2: true, fade: true } as const;
  assert.equal(encodeDesign(d), 'k=brick&s=7&v=1&l2=1&fd=1');
  assert.deepEqual(decodeDesign(encodeDesign(d)), d);
  for (const f of ['layer2', 'fade'] as const) {
    const one = { ...DESIGN_DEFAULTS, [f]: true };
    assert.deepEqual(decodeDesign(encodeDesign(one)), one);
  }
  const old = decodeDesign('k=brick&s=7&v=1');
  assert.equal(old.layer2, false);
  assert.equal(old.fade, false);
  assert.equal(encodeDesign(old), 'k=brick&s=7&v=1');
});

test('second-layer settings: one key last, round trip, clamped, malformed gives defaults, old links unchanged', () => {
  const l2 = { x: 25, y: 10, rotate: 30, scale: 1.5, opacity: 0.6, depth: 0.5 };
  const d = { ...DESIGN_DEFAULTS, kind: 'brick', seed: 7, layer2: true, fade: true, layer2Settings: l2 } as const;
  assert.equal(encodeDesign(d), 'k=brick&s=7&l2=1&fd=1&l2s=25_10_30_1.5_0.6_0.5');
  assert.deepEqual(decodeDesign(encodeDesign(d)), d);
  assert.equal(encodeDesign({ ...d, layer2Settings: { ...LAYER2_DEFAULTS } }), 'k=brick&s=7&l2=1&fd=1');
  assert.deepEqual(decodeDesign('k=brick&s=7&l2=1').layer2Settings, LAYER2_DEFAULTS);
  assert.deepEqual(decodeDesign('l2s=-5_500_-999_9_0_99').layer2Settings, { x: 0, y: 100, rotate: -180, scale: 3, opacity: 0.1, depth: 4 });
  for (const bad of ['1_2_3', '1_2_3_4_5_6_7', 'a_0_0_1_1_1', '0__0_1_1_1', '1,2,3,4,5,6', 'Infinity_0_0_1_1_1'])
    assert.deepEqual(decodeDesign(`l2s=${bad}`).layer2Settings, LAYER2_DEFAULTS, bad);
  // Literals from encodeDesign before the key existed.
  assert.equal(encodeDesign(decodeDesign('k=brick&s=7&v=1&l2=1&fd=1')), 'k=brick&s=7&v=1&l2=1&fd=1');
  const h = createHistory<Design>(DESIGN_DEFAULTS, 50, sameDesign);
  h.push(d);
  assert.deepEqual(h.undo()?.layer2Settings, LAYER2_DEFAULTS);
  assert.deepEqual(h.redo()?.layer2Settings, l2);
});

test('parallax: one key after l2s, round trip, absent is off, old links unchanged', () => {
  const l2 = { x: 25, y: 10, rotate: 30, scale: 1.5, opacity: 0.6, depth: 0.5 };
  const d = { ...DESIGN_DEFAULTS, kind: 'brick', seed: 7, layer2: true, layer2Settings: l2, parallax: true } as const;
  assert.equal(encodeDesign(d), 'k=brick&s=7&l2=1&l2s=25_10_30_1.5_0.6_0.5&px=1');
  assert.deepEqual(decodeDesign(encodeDesign(d)), d);
  assert.equal(encodeDesign({ ...d, parallax: false }), 'k=brick&s=7&l2=1&l2s=25_10_30_1.5_0.6_0.5');
  assert.equal(decodeDesign('k=brick&s=7&l2=1&l2s=25_10_30_1.5_0.6_0.5').parallax, false);
  assert.equal(decodeDesign('px=yes').parallax, false);
  // Literals from encodeDesign before the key existed.
  for (const old of ['k=brick&s=7&v=1&l2=1&fd=1', 'k=brick&s=7&l2=1&fd=1&l2s=25_10_30_1.5_0.6_0.5'])
    assert.equal(encodeDesign(decodeDesign(old)), old);
  assert.equal(sameDesign(d, { ...d, parallax: false }), false);
});

test('variant options: one vo key, round trip of 30 random sets, absent means defaults', () => {
  const r = rng(5);
  for (let n = 0; n < 30; n++) {
    const variantOptions = randomVO(r);
    const d = { ...DESIGN_DEFAULTS, variantOptions };
    const q = encodeDesign(d);
    assert.deepEqual(decodeDesign(q).variantOptions, variantOptions, q);
  }
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, variantOptions: { ...VARIANT_DEFAULTS } }), '');
  assert.equal(
    encodeDesign({
      ...DESIGN_DEFAULTS,
      variantOptions: { ...VARIANT_DEFAULTS, cells: 6, count: 6, orient: true, drop: 'half-drop', depths: true, jitter: 0.5, weights: 0.3 },
    }),
    'vo=6_6_1_h_1_0.5_0.3_0',
  );
  assert.deepEqual(decodeDesign('v=1').variantOptions, VARIANT_DEFAULTS);
  // Appended last: older keys come first.
  assert.ok(encodeDesign({ ...FULL }).endsWith('&px=1&vo=6_6_1_h_1_0.55_0.55_0.45&sx=1&fi=a_c3eaec_0.55'));
});

test('variant options: numbers are clamped, malformed values and unsupported pairs give the defaults', () => {
  assert.deepEqual(decodeDesign('vo=2_2_0_b_0_5_-1_0.9').variantOptions, {
    ...VARIANT_DEFAULTS,
    cells: 2,
    count: 2,
    drop: 'brick',
    jitter: 1,
    weights: 0,
    skip: 0.5,
  });
  for (const bad of [
    '2_6_0_n_0_0_0_0',
    '4_2_0_n_0_0_0_0',
    '3_3_0_n_0_0_0_0',
    '4_4_0_x_0_0_0_0',
    '4_4_2_n_0_0_0_0',
    '4_4_0_n_0_0_0',
    '4_4_0_n_0_0_0_0_0',
    '4_4_0_n_0_a_0_0',
    '4_4_0_n_0__0_0',
    '4_4_0_n_0_Infinity_0_0',
    '',
    '_',
    'x',
  ])
    assert.deepEqual(decodeDesign(`vo=${bad}`).variantOptions, VARIANT_DEFAULTS, bad);
});

test('sections: key sx last, round-trips, absent means false, old links unchanged', () => {
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, sections: true }), 'sx=1');
  assert.equal(decodeDesign('sx=1').sections, true);
  assert.equal(decodeDesign('sx=0').sections, false);
  assert.equal(decodeDesign('').sections, false);
  assert.equal(decodeDesign('k=fern&px=1&vo=6_6_1_h_1_0.55_0.55_0.45').sections, false);
  assert.ok(encodeDesign({ ...FULL, fill: DESIGN_DEFAULTS.fill, sections: true }).endsWith('&sx=1'));
  assert.deepEqual(decodeDesign(encodeDesign({ ...FULL, sections: false })), { ...FULL, sections: false });
  const noFill = { ...FULL, fill: DESIGN_DEFAULTS.fill };
  assert.equal(encodeDesign({ ...noFill, sections: false }) + '&sx=1', encodeDesign({ ...noFill, sections: true }));
});

test('fill: key fi last, compact, round-trips, omitted when off, malformed gives the default, old links unchanged', () => {
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, fill: { mode: 'closed', color: '#c3eaec', opacity: 1 } }), 'fi=c_c3eaec_1');
  assert.equal(encodeDesign({ ...DESIGN_DEFAULTS, fill: { mode: 'none', color: '#000000', opacity: 0.2 } }), '');
  assert.deepEqual(decodeDesign('fi=a_ABCDEF_0.4').fill, { mode: 'alternate', color: '#abcdef', opacity: 0.4 });
  assert.deepEqual(decodeDesign('fi=c_abcdef_7').fill, { mode: 'closed', color: '#abcdef', opacity: 1 });
  assert.deepEqual(decodeDesign('fi=c_abcdef_-2').fill.opacity, 0);
  for (const bad of ['x_abcdef_1', 'c_abcde_1', 'c_abcdef_', 'c_abcdef_NaN', 'c_abcdef', 'c_abcdef_1_2', ''])
    assert.deepEqual(decodeDesign(`fi=${bad}`).fill, DESIGN_DEFAULTS.fill, bad);
  assert.deepEqual(decodeDesign('k=fern&sx=1').fill, DESIGN_DEFAULTS.fill);
  assert.ok(encodeDesign(FULL).endsWith('&sx=1&fi=a_c3eaec_0.55'));
  assert.deepEqual(decodeDesign(encodeDesign(FULL)).fill, FULL.fill);
});
