import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './contrast.ts';
import { createHash } from 'node:crypto';
import { KINDS, accentGeometry, extraPath, generate, geometry, hasAccent, svgFromPolylines, tileAspect } from './fractal.ts';
import { worstTextContrast } from './pairing.ts';
import { mulberry32, type Pt } from './patterns/util.ts';
import { sceneToSvg, squareScene } from './scene.ts';
import {
  NO_FILL,
  fillScene,
  fillVisible,
  isClosed,
  plateSurfaces,
  polygonArea,
  splitClosed,
  surfaceColors,
  worstTextContrastSurfaces,
  type Surfaces,
} from './fills.ts';

const square = (x: number, y: number, s: number): Pt[] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
  [x, y],
];
const line: Pt[] = [
  [0, 0],
  [5, 5],
  [9, 1],
];
const o = { size: 100, strokeWidth: 1, color: '#123456', opacity: 0.6 };

test('isClosed needs 4 points and a repeated first point', () => {
  assert.ok(isClosed(square(0, 0, 1)));
  assert.ok(!isClosed(square(0, 0, 1).slice(0, 4)));
  assert.ok(
    !isClosed([
      [0, 0],
      [1, 0],
      [0, 0],
    ]),
  );
});

test('polygonArea by the shoelace formula, 0 for an open line', () => {
  assert.equal(polygonArea(square(0, 0, 10)), 100);
  assert.equal(
    polygonArea([
      [0, 0],
      [10, 0],
      [0, 10],
      [0, 0],
    ]),
    50,
  );
  assert.equal(polygonArea(line), 0);
});

test('splitClosed keeps order and respects minArea', () => {
  const polys = [square(0, 0, 1), line, square(5, 5, 3), square(9, 9, 2)];
  assert.deepEqual(splitClosed(polys), { closed: [polys[0], polys[2], polys[3]], open: [line] });
  assert.deepEqual(splitClosed(polys, 4), { closed: [polys[2]], open: [polys[0], line, polys[3]] });
});

test('fillScene layers: fill under stroke, alternate, none', () => {
  const polys = [square(0, 0, 10), square(20, 0, 10), line];
  assert.deepEqual(fillScene(polys, o, { mode: 'none', color: '#ff0000', opacity: 1 }), squareScene(polys, o));
  const s = fillScene(polys, o, { mode: 'closed', color: '#ff0000', opacity: 1 });
  assert.equal(s.layers.length, 2);
  assert.equal(s.layers[0]!.paint.mode, 'fill');
  assert.equal(s.layers[0]!.polys.length, 2);
  assert.equal(s.layers[1]!.paint.mode, 'stroke');
  assert.equal(s.layers[1]!.polys.length, 3);
  const svg = sceneToSvg(s, 2);
  assert.ok(svg.indexOf('fill="#ff0000"') < svg.indexOf('stroke="#123456"'));
  const five = [0, 1, 2, 3, 4].map((i) => square(i * 20, 0, 10));
  const alt = fillScene(five, o, { mode: 'alternate', color: '#ff0000', opacity: 1 });
  assert.equal(alt.layers[0]!.polys.length, 3);
  const none = fillScene([line], o, { mode: 'closed', color: '#ff0000', opacity: 1 });
  assert.equal(none.layers.length, 1);
  assert.equal(none.layers[0]!.paint.mode, 'stroke');
});

test('real kinds have closed shapes and render a fill', () => {
  for (const kind of ['nested', 'dots', 'hex', 'carpet', 'whirl'] as const) {
    const polys = geometry({ kind, seed: 1, depth: 2, size: 120 });
    assert.ok(splitClosed(polys).closed.length > 0, kind);
    const svg = sceneToSvg(fillScene(polys, { ...o, size: 120 }, { mode: 'closed', color: '#ff0000', opacity: 1 }), 2);
    assert.ok(svg.includes('fill-rule="evenodd"'), kind);
  }
});

const ROLE_SETS = [
  { background: '#ffffff', pattern: '#336699', text: '#000000' },
  { background: '#f4ecd8', pattern: '#a0522d', text: '#2b1d0e' },
  { background: '#101820', pattern: '#88ccee', text: '#fafafa' },
];

test('surfaceColors: 2 without a fill (matching worstTextContrast), 4 with one', () => {
  for (const r of ROLE_SETS) {
    const s: Surfaces = { background: r.background, pattern: r.pattern, patternOpacity: 0.6, fill: null, fillOpacity: 1 };
    assert.equal(surfaceColors(s).length, 2);
    assert.ok(Math.abs(worstTextContrastSurfaces(r.text, s) - worstTextContrast(r, 0.6)) < 1e-9);
    assert.equal(surfaceColors({ ...s, fill: '#ff8800' }).length, 4);
  }
});

test('a fill can only lower or keep the worst case', () => {
  const rnd = mulberry32(7);
  const hex = () =>
    '#' +
    Math.floor(rnd() * 0x1000000)
      .toString(16)
      .padStart(6, '0');
  for (let i = 0; i < 50; i++) {
    const text = hex();
    const s: Surfaces = { background: hex(), pattern: hex(), patternOpacity: rnd(), fill: null, fillOpacity: rnd() };
    assert.ok(worstTextContrastSurfaces(text, { ...s, fill: hex() }) <= worstTextContrastSurfaces(text, s) + 1e-9);
  }
});

test('text equal to the fill surface gives 1; a fill at opacity 0 gives 21', () => {
  const s: Surfaces = { background: '#ffffff', pattern: '#000000', patternOpacity: 0, fill: '#000000', fillOpacity: 1 };
  assert.ok(Math.abs(worstTextContrastSurfaces('#000000', s) - 1) < 1e-9);
  assert.ok(Math.abs(worstTextContrastSurfaces('#000000', { ...s, fillOpacity: 0 }) - 21) < 1e-9);
});

test('plateSurfaces: 1 leaves the background, 0 changes nothing, mid follows the formula', () => {
  const s: Surfaces = { background: '#f4ecd8', pattern: '#a0522d', patternOpacity: 0.6, fill: '#336699', fillOpacity: 0.8 };
  const text = '#2b1d0e';
  assert.ok(Math.abs(worstTextContrastSurfaces(text, plateSurfaces(s, 1)) - contrastRatio(text, s.background)) < 1e-9);
  assert.deepEqual(plateSurfaces(s, 0), s);
  assert.deepEqual(plateSurfaces(s, 0.3), { ...s, patternOpacity: 0.6 * 0.7, fillOpacity: 0.8 * 0.7 });
});

test('fillVisible is 1 without a fill and above 1 for a different fill', () => {
  const s: Surfaces = { background: '#ffffff', pattern: '#000000', patternOpacity: 0.6, fill: null, fillOpacity: 1 };
  assert.equal(fillVisible(s), 1);
  assert.ok(fillVisible({ ...s, fill: '#336699' }) > 1);
});

const ACCENT_STROKE = { size: 20, strokeWidth: 1, color: '#000000', opacity: 1 };

test('accent shapes: a fill layer over the fill and under the strokes, at full opacity', () => {
  const polys = [square(0, 0, 10), line];
  const berry = square(12, 12, 4);
  const scene = fillScene(polys, ACCENT_STROKE, { mode: 'closed', color: '#00ff00', opacity: 0.5 }, { polys: [berry], color: '#e07a3f' });
  assert.deepEqual(
    scene.layers.map((l) => [l.paint.mode, l.paint.color, l.paint.opacity]),
    [
      ['fill', '#00ff00', 0.5],
      ['fill', '#e07a3f', 1],
      ['stroke', '#000000', 1],
    ],
  );
  assert.deepEqual(scene.layers[1]!.polys, [berry]);
  // Without a fill, the accent sits right under the strokes.
  const alone = fillScene(polys, ACCENT_STROKE, NO_FILL, { polys: [berry], color: '#e07a3f' });
  assert.deepEqual(
    alone.layers.map((l) => l.paint.mode),
    ['fill', 'stroke'],
  );
  assert.ok(sceneToSvg(alone, 1).includes('fill="#e07a3f" fill-opacity="1"'));
});

test('no accent shapes: the scene and its bytes are those without the hook', () => {
  const polys = [square(0, 0, 10), line];
  for (const fill of [NO_FILL, { mode: 'closed', color: '#00ff00', opacity: 0.5 } as const]) {
    const before = sceneToSvg(fillScene(polys, ACCENT_STROKE, fill), 1);
    assert.equal(sceneToSvg(fillScene(polys, ACCENT_STROKE, fill, { polys: [], color: '#e07a3f' }), 1), before);
  }
  assert.deepEqual(fillScene(polys, ACCENT_STROKE, NO_FILL), squareScene(polys, ACCENT_STROKE));
});

test('every kind without the accent hook: no accent shapes, generate() as before at 3 seeds', () => {
  for (const kind of KINDS.filter((k) => !hasAccent(k))) {
    assert.deepEqual(accentGeometry({ kind, seed: 1, depth: 2, size: 120 }), [], kind);
    for (const seed of [1, 42, 2692185587]) {
      const p = { kind, seed, depth: 2, size: 120, strokeWidth: 2, precision: 1, color: '#336699', opacity: 0.6, accent: '#e07a3f' };
      assert.equal(generate(p), svgFromPolylines(geometry(p), p, tileAspect(kind), extraPath(p)), `${kind}/${seed}`);
    }
  }
});

// sha256 (first 16 hex digits) of generate() on the commit before the accent hook (3b3afad). A fixed list, not KINDS,
// so a kind added later does not change this test.
const GENERATE_BEFORE: Record<string, string> = {
  'tree/1': '5efa51add3d599c2',
  'tree/42': 'c89e6e5bb0b17ee8',
  'tree/2692185587': '4de09a8c769b0f9a',
  'carpet/1': 'f6adc491d004b70c',
  'carpet/42': '4f5a383ab23d22e3',
  'carpet/2692185587': 'c80917aec957bb6d',
  'hex/1': '81b63dd9bb33919f',
  'hex/42': 'b7ccdf888ab233e5',
  'hex/2692185587': '0870907508cccd3b',
  'penrosearcs/1': '3d45ef5b7afdc972',
  'penrosearcs/42': '049de0848ce2f5dc',
  'penrosearcs/2692185587': '3fa74387b9f2902e',
  'p6m/1': '12b91ff3117cfdba',
  'p6m/42': '1d9c64be365be18d',
  'p6m/2692185587': 'cd744dad2d1d0fb6',
  'chladni/1': '2a800baae9b74f68',
  'chladni/42': 'd1c28c250cd3c8cb',
  'chladni/2692185587': '02b962dc75fdba73',
  'quilt/1': '9ada2dc24907a684',
  'quilt/42': '6b6e9ce624f34cee',
  'quilt/2692185587': '0ab46d4df2ffb8c0',
  'dodecastars/1': '1d2d58a7186f1df6',
  'dodecastars/42': '8f84b29a197556c1',
  'dodecastars/2692185587': '6b41df8088bd0842',
};

test('generate() is byte-identical to before the accent hook, with or without an accent color', () => {
  for (const [key, hash] of Object.entries(GENERATE_BEFORE)) {
    const [kind, seed] = key.split('/') as [(typeof KINDS)[number], string];
    const p = { kind, seed: Number(seed), depth: 3, size: 120, strokeWidth: 2, precision: 1, color: '#336699', opacity: 0.6 };
    const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
    assert.equal(sha(generate(p)), hash, key);
    assert.equal(sha(generate({ ...p, accent: '#e07a3f' })), hash, key);
  }
});

test('the accent surface joins the worst case: black text over a #808080 accent', () => {
  const s: Surfaces = { background: '#ffffff', pattern: '#000000', patternOpacity: 0, fill: null, fillOpacity: 1, accent: '#808080' };
  const worst = worstTextContrastSurfaces('#000000', s);
  // L(#808080) = ((128/255 + 0.055) / 1.055)^2.4 = 0.21586; (0.21586 + 0.05) / 0.05 = 5.317.
  assert.equal(worst, contrastRatio('#000000', '#808080'));
  assert.ok(Math.abs(worst - 5.317) < 0.001, `${worst}`);
  // Without the accent the worst case is the white background, 21:1.
  assert.equal(worstTextContrastSurfaces('#000000', { ...s, accent: null }), 21);
  // Under a plate of 0.5 the accent shows at half strength.
  assert.ok(surfaceColors(plateSurfaces(s, 0.5)).includes('#c0c0c0'));
});
