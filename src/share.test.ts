import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, MAX_DEPTH } from './fractal.ts';
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
    families: int(1, 15),
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
  assert.ok(Number.isInteger(d.families) && inRange(d.families, 1, 15), label);
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
  assert.ok(s.length <= 180, `${s.length}`);
  assert.deepEqual(decodeDesign(s), FULL);
});

test('hostile input never throws and gives a valid design', () => {
  const r = rng(99);
  const bytes = String.fromCharCode(...Array.from({ length: 10000 }, () => Math.floor(r() * 256)));
  const cases = ['%', 'k=__proto__', 'k=constructor&s=-1', 's=1e99', 's=abc', 'd=999', 'bg=zzzzzz', 'bg=fff', 'o=5', 'o=-3', bytes, 's=5&s=6'];
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
  assert.equal(decodeDesign('fa=999').families, 15);
  assert.equal(decodeDesign('l=x').layout, 'single');
  assert.equal(decodeDesign('f=yes').frame, false);
  assert.equal(encodeDesign(DESIGN_DEFAULTS), '');
});
