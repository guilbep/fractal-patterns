import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../patterns/util.ts';
import {
  instanceMatrix,
  layerColors,
  passInstances,
  repeatCell,
  studioBytes,
  studioInstances,
  studioSvg,
  wrapOffsets,
  type Instance,
  type Placement,
  type Repeat,
  type Studio,
} from './model.ts';

const base: Studio = { width: 100, height: 80, background: null, repeat: 'straight', motifs: [], layers: [] };
const SQ = { d: 'M0 0h10v10H0z', box: 10, paint: 'fill' as const };
const place = (motif: number, x: number, y: number, scale = 1, rotate = 0, flip = false): Placement => ({
  motif,
  x,
  y,
  scale,
  rotate,
  flip,
});

test('repeatCell gives the cell and the copies for each repeat type', () => {
  const c = (repeat: Repeat) => repeatCell({ ...base, repeat });
  const f = { flipX: false, flipY: false };
  assert.deepEqual(c('straight'), { width: 100, height: 80, copies: [{ dx: 0, dy: 0, ...f }] });
  assert.deepEqual(c('half-drop'), {
    width: 200,
    height: 80,
    copies: [
      { dx: 0, dy: 0, ...f },
      { dx: 100, dy: 40, ...f },
    ],
  });
  assert.deepEqual(c('brick'), {
    width: 100,
    height: 160,
    copies: [
      { dx: 0, dy: 0, ...f },
      { dx: 50, dy: 80, ...f },
    ],
  });
  assert.deepEqual(c('mirror'), {
    width: 200,
    height: 160,
    copies: [
      { dx: 0, dy: 0, flipX: false, flipY: false },
      { dx: 100, dy: 0, flipX: true, flipY: false },
      { dx: 0, dy: 80, flipX: false, flipY: true },
      { dx: 100, dy: 80, flipX: true, flipY: true },
    ],
  });
});

test('wrapOffsets covers the edges and corners', () => {
  assert.deepEqual(wrapOffsets({ x: 50, y: 40 }, 5, 100, 80), [[0, 0]]);
  assert.deepEqual(wrapOffsets({ x: 2, y: 40 }, 5, 100, 80), [
    [0, 0],
    [100, 0],
  ]);
  const corner = wrapOffsets({ x: 98, y: 1 }, 5, 100, 80);
  assert.equal(corner.length, 4);
  assert.equal(new Set(corner.map((o) => o.join())).size, 4);
  assert.ok(corner.some(([x, y]) => x === 0 && y === 0));
});

type M = [number, number, number, number, number, number];
const corners = (m: M, box: number): [number, number][] =>
  [
    [0, 0],
    [box, 0],
    [box, box],
    [0, box],
  ].map(([u = 0, v = 0]) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]);
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const sameM = (a: M, b: M) => a.every((v, k) => near(v, b[k] ?? NaN));
const shifted = (m: M, dx: number, dy: number): M => [m[0], m[1], m[2], m[3], m[4] + dx, m[5] + dy];
const nearMod = (a: number, b: number, c: number) => {
  const r = (((a - b) % c) + c) % c;
  return r < 1e-6 || c - r < 1e-6;
};

function seeded(repeat: Repeat): Studio {
  const rnd = mulberry32(7);
  const placements = Array.from({ length: 6 }, () => place(0, rnd() * 100, rnd() * 80, 0.5 + rnd() * 2, rnd() * 360, rnd() < 0.5));
  // Two placements on edges so that wrapping is always exercised.
  placements.push(place(0, 1, 40, 2, 30, true), place(0, 99, 79, 2, 10, false));
  return { ...base, repeat, motifs: [SQ], layers: [{ color: '#112233', opacity: 1, strokeWidth: 1, placements }] };
}

for (const repeat of ['straight', 'half-drop', 'brick', 'mirror'] as const)
  test(`the ${repeat} repeat is seamless`, () => {
    const s = seeded(repeat);
    const cell = repeatCell(s);
    const ms = studioInstances(s).map((i: Instance) => instanceMatrix(i, 10));
    const has = (m: M) => ms.some((n) => sameM(n, m));
    for (const m of ms) {
      const xs = corners(m, 10).map((p) => p[0]);
      const ys = corners(m, 10).map((p) => p[1]);
      if (Math.min(...xs) < 0) assert.ok(has(shifted(m, cell.width, 0)), 'left edge');
      if (Math.max(...xs) > cell.width) assert.ok(has(shifted(m, -cell.width, 0)), 'right edge');
      if (Math.min(...ys) < 0) assert.ok(has(shifted(m, 0, cell.height)), 'top edge');
      if (Math.max(...ys) > cell.height) assert.ok(has(shifted(m, 0, -cell.height)), 'bottom edge');
    }
    const shift = repeat === 'half-drop' ? [100, 40] : repeat === 'brick' ? [50, 80] : null;
    if (shift)
      for (const m of ms)
        assert.ok(
          ms.some(
            (n) =>
              sameM(n.slice(0, 4).concat(0, 0) as M, m.slice(0, 4).concat(0, 0) as M) &&
              nearMod(n[4], m[4] + (shift[0] ?? 0), cell.width) &&
              nearMod(n[5], m[5] + (shift[1] ?? 0), cell.height),
          ),
          'shift partner',
        );
    if (repeat === 'mirror') {
      const key = (ps: [number, number][]) =>
        ps
          .map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`)
          .sort()
          .join(' ');
      const set = new Set(ms.map((m) => key(corners(m, 10))));
      for (const m of ms) assert.ok(set.has(key(corners(m, 10).map(([x, y]) => [cell.width - x, y]))), 'mirror partner');
    }
  });

test('studioSvg writes a small studio exactly', () => {
  const s: Studio = {
    ...base,
    background: '#fafafa',
    motifs: [SQ, { d: 'M0 5h10', box: 10, paint: 'stroke' }],
    layers: [
      { color: '#ff0000', opacity: 1, strokeWidth: 1, placements: [place(0, 20, 30)] },
      { color: '#0000ff', opacity: 0.5, strokeWidth: 2, placements: [place(1, 50, 40, 2, 90, true)] },
    ],
  };
  const svg = studioSvg(s);
  assert.equal(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80">' +
      '<path fill="#fafafa" d="M0 0h100v80H0z"/>' +
      '<defs><path id="a" d="M0 0h10v10H0z"/><path id="b" d="M0 5h10" vector-effect="non-scaling-stroke"/></defs>' +
      '<g fill="#ff0000"><use href="#a" transform="translate(15 25)"/></g>' +
      '<g fill="none" stroke="#0000ff" stroke-width="2" stroke-opacity="0.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">' +
      '<use href="#b" transform="translate(50 40) rotate(90) scale(-2 2) translate(-5 -5)"/></g></svg>',
  );
  assert.ok(!svg.includes('\n'));
});

test('unsafe input is skipped or falls back', () => {
  const s: Studio = {
    ...base,
    motifs: [{ d: 'M0 0"><script>', box: 10, paint: 'fill' }, SQ],
    layers: [{ color: 'red', opacity: 1, strokeWidth: 1, placements: [place(0, 50, 40), place(1, NaN, 40), place(1, 50, 40)] }],
  };
  const svg = studioSvg(s);
  assert.ok(!svg.includes('script'));
  assert.ok(svg.includes('<path id="a" d="M0 0h10v10H0z"/>'));
  assert.ok(!svg.includes('id="b"'));
  assert.ok(svg.includes('<g fill="#000000">'));
  assert.ok(!svg.includes('fill-opacity'));
  assert.equal(svg.match(/<use /g)?.length, 1);
});

test('studioBytes: <use> is far smaller than full paths, and wraps count', () => {
  const rnd = mulberry32(3);
  const d = `M0 0${'l1 1'.repeat(99)}`;
  assert.equal(d.length, 400);
  const motifs = Array.from({ length: 5 }, () => ({ d, box: 10, paint: 'fill' as const }));
  const placements = Array.from({ length: 60 }, (_, k) => place(k % 5, rnd() * 100, rnd() * 80, 1, rnd() * 360));
  const s: Studio = { ...base, motifs, layers: [{ color: '#123456', opacity: 1, strokeWidth: 1, placements }] };
  const b = studioBytes(s);
  assert.ok(b.svg * 3 < b.expanded, `${b.svg} vs ${b.expanded}`);
  assert.equal(b.instances, studioInstances(s).length);
  assert.ok(b.instances > 60);
});

test('layerColors lists distinct colors in order', () => {
  const l = (color: string) => ({ color, opacity: 1, strokeWidth: 1, placements: [] });
  assert.deepEqual(layerColors({ ...base, layers: [l('#aa0000'), l('#00bb00'), l('#aa0000'), l('#0000cc')] }), [
    '#aa0000',
    '#00bb00',
    '#0000cc',
  ]);
});

test('an evenodd motif is written with fill-rule="evenodd" and may be longer; others are unchanged', () => {
  const ring = { d: 'M0 0h10v10H0zM3 3h4v4H3z', box: 10, paint: 'fill' as const };
  const layers = [{ color: '#123456', opacity: 1, strokeWidth: 1, placements: [place(0, 50, 40)] }];
  const plain = studioSvg({ ...base, motifs: [ring], layers });
  assert.doesNotMatch(plain, /fill-rule/);
  const eo = studioSvg({ ...base, motifs: [{ ...ring, evenodd: true }], layers });
  assert.equal(eo, plain.replace(`d="${ring.d}"/>`, `d="${ring.d}" fill-rule="evenodd"/>`));
  const long = { d: 'M0 0' + 'h1v1'.repeat(6000) + 'z', box: 10, paint: 'fill' as const };
  assert.doesNotMatch(studioSvg({ ...base, motifs: [long], layers }), /<use/);
  assert.match(studioSvg({ ...base, motifs: [{ ...long, evenodd: true }], layers }), /<use/);
  assert.equal(studioInstances({ ...base, motifs: [{ ...long, evenodd: true }], layers }).length > 0, true);
});

test("overlap 'down': copies moved up are drawn first, copies moved down last; the default keeps list order", () => {
  // Box 20 at scale 1: radius 14.14. A crosses the top edge, C the bottom edge, B neither.
  const s: Studio = {
    ...base,
    height: 100,
    motifs: [{ d: 'M0 0h20v20H0z', box: 20, paint: 'fill' }],
    layers: [{ color: '#000000', opacity: 1, strokeWidth: 1, placements: [place(0, 50, 5), place(0, 50, 50), place(0, 50, 95)] }],
  };
  const ys = (t: Studio): number[] => studioInstances(t).map((i) => i.y);
  assert.deepEqual(ys(s), [5, 105, 50, 95, -5]);
  assert.deepEqual(ys({ ...s, overlap: 'down' }), [-5, 5, 50, 95, 105]);
  assert.equal(studioSvg(s), studioSvg({ ...s, overlap: 'none' }));
});

test("overlap 'down' keeps the pass order across layers in studioSvg", () => {
  // Two layers: the top item in red, the bottom item in blue. The red copy at the bottom edge must come after every blue use.
  const s: Studio = {
    ...base,
    height: 100,
    overlap: 'down',
    motifs: [{ d: 'M0 0h20v20H0z', box: 20, paint: 'fill' }],
    layers: [
      { color: '#ff0000', opacity: 1, strokeWidth: 1, placements: [place(0, 50, 5)] },
      { color: '#0000ff', opacity: 1, strokeWidth: 1, placements: [place(0, 50, 95)] },
    ],
  };
  const svg = studioSvg(s);
  assert.deepEqual(
    [...svg.matchAll(/<g fill="(#[0-9a-f]{6})">((?:<use [^>]*>)*)<\/g>/g)].map((m) => [
      m[1],
      m[2]!.match(/translate\(40 (-?\d+)\)/g)!.join(),
    ]),
    [
      ['#0000ff', 'translate(40 -15)'],
      ['#ff0000', 'translate(40 -5)'],
      ['#0000ff', 'translate(40 85)'],
      ['#ff0000', 'translate(40 95)'],
    ],
  );
});

test("passInstances tags the wrap copies with their pass under overlap 'down'", () => {
  const s: Studio = {
    ...base,
    height: 100,
    overlap: 'down',
    motifs: [{ d: 'M0 0h20v20H0z', box: 20, paint: 'fill' }],
    layers: [{ color: '#000000', opacity: 1, strokeWidth: 1, placements: [place(0, 50, 5), place(0, 50, 50), place(0, 50, 95)] }],
  };
  const t = passInstances(s);
  assert.deepEqual(
    t.map((p) => p.pass),
    [-1, 0, 0, 0, 1],
  );
  assert.deepEqual(
    t.map((p) => p.i.y),
    [-5, 5, 50, 95, 105],
  );
});
