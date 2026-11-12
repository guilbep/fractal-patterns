import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from './contrast.ts';
import { geometry } from './fractal.ts';
import { worstTextContrast } from './pairing.ts';
import { mulberry32, type Pt } from './patterns/util.ts';
import { sceneToSvg, squareScene } from './scene.ts';
import {
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
