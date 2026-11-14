import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrangement, colourFaces, regionsSvg } from './regions.ts';
import { geometry } from '../fractal.ts';
import { starGenerator } from './stars.ts';
import { mulberry32, wrap, type Poly, type Pt } from './util.ts';

const S = 120;
const lines = (xs: number[], ys: number[]): Poly[] => [
  ...xs.map((x): Poly => [
    [x, 0],
    [x, S],
  ]),
  ...ys.map((y): Poly => [
    [0, y],
    [S, y],
  ]),
];
const circle = (cx: number, cy: number, r: number): Poly =>
  Array.from({ length: 49 }, (_, i): Pt => [cx + r * Math.cos((i * 2 * Math.PI) / 48), cy + r * Math.sin((i * 2 * Math.PI) / 48)]);
const total = (polys: Poly[]) => arrangement(polys, S).faces.reduce((s, f) => s + f.area, 0);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-6 * Math.abs(b), `${a} vs ${b}`);

test('one meridian and one longitude leave the torus in one piece', () => {
  const { faces, adjacency } = arrangement(lines([S / 2], [S / 2]), S);
  assert.equal(faces.length, 1);
  close(faces[0]!.area, S * S);
  assert.deepEqual(adjacency, [[]]);
});

test('two meridians and two longitudes make 4 faces of a quarter each', () => {
  const { faces, adjacency } = arrangement(lines([S / 4, (3 * S) / 4], [S / 4, (3 * S) / 4]), S);
  assert.equal(faces.length, 4);
  for (const f of faces) close(f.area, (S * S) / 4);
  // 2x2 cells on a torus: both meridians border the same neighbour, so each face has 2 neighbours, not 3.
  for (const ns of adjacency) assert.equal(ns.length, 2);
});

test('no lines: one face', () => {
  const { faces } = arrangement([], S);
  assert.equal(faces.length, 1);
  close(faces[0]!.area, S * S);
});

test('total area and counts with circles', () => {
  close(total(lines([S / 4, (3 * S) / 4], [S / 4, (3 * S) / 4])), S * S);
  const inner = [0, 1, 2].flatMap((i) => [0, 1].map((j) => circle(S / 6 + (i * S) / 3, S / 4 + (j * S) / 2, S / 10)));
  const a = arrangement(inner, S);
  assert.equal(a.faces.length, 7);
  close(
    a.faces.reduce((s, f) => s + f.area, 0),
    S * S,
  );
  const edge = wrap(
    [0, 1, 2].flatMap((i) => [0, 1].map((j) => circle((i * S) / 3, (j * S) / 2 + 3, S / 10))),
    S,
  );
  const b = arrangement(edge, S);
  assert.equal(b.faces.length, 7);
  close(
    b.faces.reduce((s, f) => s + f.area, 0),
    S * S,
  );
});

test('4x4 checkerboard is 2-colourable', () => {
  const q = [0, 1, 2, 3].map((i) => (i * S) / 4);
  const { faces, adjacency } = arrangement(lines(q, q), S);
  assert.equal(faces.length, 16);
  for (const ns of adjacency) assert.equal(ns.length, 4);
  const { colour, ok } = colourFaces(faces, adjacency, 'neighbours', 2);
  assert.equal(ok, true);
  adjacency.forEach((ns, i) => ns.forEach((j) => assert.notEqual(colour[i], colour[j])));
  assert.match(regionsSvg(faces, colour, ['#000', '#fff'], S), /^<path fill="#000"[^>]*\/><path fill="#fff"/);
  const shape = colourFaces(faces, adjacency, 'shape', 3);
  assert.equal(new Set(shape.colour).size, 1);
});

test('deterministic and stable under a tiny jitter', () => {
  const polys = wrap(starGenerator('488')(mulberry32(1), 1, S), S);
  const a = arrangement(polys, S);
  assert.deepEqual(arrangement(polys, S), a);
  const r = mulberry32(7);
  const jittered = polys.map((p) => p.map(([x, y]): Pt => [x + (r() - 0.5) * 2e-9, y + (r() - 0.5) * 2e-9]));
  const b = arrangement(jittered, S);
  assert.equal(b.faces.length, a.faces.length);
  assert.deepEqual(b.adjacency, a.adjacency);
  a.faces.forEach((f, i) => close(b.faces[i]!.area, f.area));
});

test('speed on app tiles', () => {
  const tiles: [string, Poly[]][] = [
    ...(['p4m', 'truchet', 'hex'] as const).map((kind): [string, Poly[]] => [
      kind,
      wrap(geometry({ kind, seed: 1, depth: 3, size: S }) as Poly[], S),
    ]),
    ['stars 488', wrap(starGenerator('488')(mulberry32(1), 1, S), S)],
  ];
  for (const [name, polys] of tiles) {
    const t = performance.now();
    const { faces, adjacency } = arrangement(polys, S);
    const { ok } = colourFaces(faces, adjacency, 'neighbours', 4);
    const ms = performance.now() - t;
    console.log(`${name}: ${faces.length} faces, ${ms.toFixed(1)} ms, 4 colours ${ok ? 'suffice' : 'do not suffice'}`);
    close(
      faces.reduce((s, f) => s + f.area, 0),
      S * S,
    );
    assert.ok(ms < 500, `${name} ${ms} ms`);
  }
});
