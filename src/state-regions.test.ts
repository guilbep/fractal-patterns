import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const { params, svg, regions, regionsReady, regionsInfo, regionColors, checkedRoles, contrast, reset, REGION_LIMITS } =
  await import('./state.ts');
// The 60 ms budget depends on the machine and the load of the test run: lifted here, tested on its own below.
REGION_LIMITS.ms = Infinity;
const { textSurfaces } = await import('./pairing.ts');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const at = (kind: string, seed: number, depth: number, mode: 'off' | 'shape' | 'neighbours', k = 4): string => {
  Object.assign(params, { kind, seed, depth });
  Object.assign(regions, { mode, k });
  return svg.value;
};

test('off: the p4m tile is unchanged (pinned before Color each region)', () => {
  const s = at('p4m', 7, 8, 'off');
  assert.equal(s.length, 8479);
  assert.equal(sha(s), 'f719039a83e397a1');
  assert.equal(checkedRoles.value.regions, null);
});

test('by shape, p4m: region paths under the lines, k colours used', async () => {
  at('p4m', 7, 8, 'shape');
  await regionsReady();
  for (const k of [2, 3, 4]) {
    const s = at('p4m', 7, 8, 'shape', k);
    assert.equal(regionColors.value.length, k);
    const fills = [...s.matchAll(/<path fill="(#[0-9a-f]{6})" fill-rule="nonzero"/g)].map((m) => m[1]);
    assert.deepEqual(fills, regionColors.value);
    // The regions come before the strokes, so the lines stay on top.
    assert.ok(s.indexOf('fill-rule="nonzero"') < s.indexOf('stroke-width'));
  }
  assert.ok(regionsInfo.value!.faces > 0 && regionsInfo.value!.ok);
});

test('neighbours differ, stars 4.8.8 depth 2: 4 colours suffice', async () => {
  at('star-488', 1, 2, 'neighbours');
  await regionsReady();
  assert.ok(regionsInfo.value!.faces > 0);
  assert.equal(regionsInfo.value!.ok, true);
  assert.equal(regionsInfo.value!.note, '');
});

test('honeycomb, 4 colours: not enough, the note says so', async () => {
  at('hex', 1, 3, 'neighbours');
  await regionsReady();
  assert.equal(regionsInfo.value!.faces, 70);
  assert.equal(regionsInfo.value!.ok, false);
  assert.equal(regionsInfo.value!.note, '4 colors are not enough here: neighbours may share a color.');
});

test('the contrast check covers each region colour', async () => {
  at('p4m', 7, 8, 'neighbours');
  await regionsReady();
  const r = checkedRoles.value;
  assert.deepEqual(r.regions, regionColors.value);
  const surfaces = textSurfaces(r, 1, 0);
  for (const c of regionColors.value) assert.ok(surfaces.includes(c), c);
  const without = contrast.value.direct;
  regions.mode = 'off';
  assert.ok(contrast.value.direct >= without);
});

test('past a limit: lines only, the reason shown, no region colour checked', async () => {
  const off = at('p4m', 7, 8, 'off');
  at('p4m', 7, 8, 'shape');
  await regionsReady();
  REGION_LIMITS.faces = 10;
  params.seed = 8; // a new tile: the faces are found again under the new limit
  params.seed = 7;
  assert.equal(svg.value, off);
  assert.match(regionsInfo.value!.note, /^\d+ regions are too many to color: lines only\.$/);
  assert.equal(checkedRoles.value.regions, null);
  REGION_LIMITS.faces = 2000;
});

// The region paths' points, as drawn in the tile SVG.
const regionPoints = (s: string) =>
  [...s.matchAll(/<path fill="#[0-9a-f]{6}" fill-rule="nonzero" d="([^"]*)"/g)].flatMap((m) =>
    [...m[1]!.matchAll(/(-?\d+) (-?\d+)/g)].map((p) => [Number(p[1]), Number(p[2])] as const),
  );

for (const [kind, depth] of [
  ['star-hex', 2],
  ['p6m', 2],
] as const)
  test(`neighbours differ, ${kind} depth ${depth}: regions on the 1 by sqrt(3) tile, stretched like the lines`, async () => {
    const off = at(kind, 1, depth, 'off');
    at(kind, 1, depth, 'neighbours');
    await regionsReady();
    const s = at(kind, 1, depth, 'neighbours');
    const size = params.size;
    const h = Math.round(size * Math.sqrt(3) * 1000) / 1000;
    assert.ok(off.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">`));
    assert.equal(s.slice(0, s.indexOf('>') + 1), off.slice(0, off.indexOf('>') + 1));
    assert.ok(regionsInfo.value!.faces > 0);
    const pts = regionPoints(s);
    assert.ok(pts.length > 0);
    const ys = pts.map((p) => p[1]);
    assert.equal(Math.min(...ys), 0);
    assert.equal(Math.max(...ys), Math.round(size * Math.sqrt(3)));
    assert.ok(Math.max(...pts.map((p) => p[0])) <= size);
    // The faces cover the squeezed tile once.
    const { findRegions } = await import('./regions-tile.ts');
    const { geometry, tileAspect } = await import('./fractal.ts');
    const r = findRegions(geometry({ ...params }), size, { faces: Infinity, ms: Infinity }, tileAspect(kind));
    const area = r.faces.reduce((a, f) => a + f.area, 0);
    assert.ok(Math.abs(area / size ** 2 - 1) < 1e-6, String(area));
  });

test('star-hex: a region cut by the tile edge is drawn on both sides, as the lines are', async () => {
  at('star-hex', 1, 2, 'neighbours');
  await regionsReady();
  const { findRegions } = await import('./regions-tile.ts');
  const { geometry, tileAspect } = await import('./fractal.ts');
  const size = params.size;
  const H = size * Math.sqrt(3);
  const r = findRegions(geometry({ ...params }), size, { faces: Infinity, ms: Infinity }, tileAspect('star-hex'));
  const near = (l: readonly (readonly [number, number])[], i: 0 | 1, v: number) => l.some((p) => Math.abs(p[i] - v) < 1e-6);
  let x = 0;
  let y = 0;
  for (const f of r.faces) {
    if (f.loops.some((l) => near(l, 0, 0)) && f.loops.some((l) => near(l, 0, size))) x++;
    if (f.loops.some((l) => near(l, 1, 0)) && f.loops.some((l) => near(l, 1, H))) y++;
  }
  assert.ok(x > 0 && y > 0, `${x} ${y}`);
});

test('Penrose arcs: no region colours, the reason shown', async () => {
  const { regionsOffReason } = await import('./state.ts');
  const off = at('penrosearcs', 1, 2, 'off');
  assert.equal(at('penrosearcs', 1, 2, 'neighbours'), off);
  assert.equal(regionsOffReason.value, 'Region colors do not follow the arcs; choose Penrose rhombs to use them.');
  at('star-hex', 1, 2, 'off');
  assert.equal(regionsOffReason.value, '');
});

test('reset turns it off', () => {
  at('p4m', 7, 8, 'shape', 2);
  reset();
  assert.deepEqual({ ...regions }, { mode: 'off', k: 4 });
});
