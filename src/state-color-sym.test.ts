import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const { params, svg, farrisReady, checkedRoles, bandColors } = await import('./state.ts');
const { altReason } = await import('./state-export.ts');
const { colorSym, orderedColors } = await import('./color-sym.ts');
const { PALETTES } = await import('./palettes.ts');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const at = (kind: string, on: boolean): string => {
  params.kind = kind as typeof params.kind;
  params.seed = 7;
  colorSym.on = on;
  return svg.value;
};

test('off: the p4m tile is unchanged (pinned before Color symmetry)', () => {
  const s = at('p4m', false);
  assert.equal(s.length, 8479);
  assert.equal(sha(s), 'f719039a83e397a1');
});

test('on, p4m: the Farris modules load on demand, then bands, other formats off, every band checked', async () => {
  at('p4m', true);
  await farrisReady();
  const s = svg.value;
  assert.equal(s.match(/<path[^>]*fill-rule="evenodd"/g)?.length, 4);
  assert.equal(altReason.value, 'Color symmetry draws color bands; these formats draw lines.');
  assert.equal(bandColors.value.length, 5);
  assert.deepEqual(checkedRoles.value.bands, bandColors.value);
  colorSym.on = false;
  assert.equal(checkedRoles.value.bands, null);
});

test('on, p4m: 4 even-odd bands in the 5 palette colours, no strokes', () => {
  const s = at('p4m', true);
  assert.equal(s.match(/<path[^>]*fill-rule="evenodd"/g)?.length, 4);
  assert.equal(s.match(/<path/g)?.length, 4);
  const lagoon = PALETTES.find((p) => p.name === 'Lagoon')!.colors;
  for (const c of orderedColors(lagoon, 0)) assert.ok(s.includes(`fill="${c}"`), c);
  assert.ok(!s.includes('stroke-width'));
});

test('on, p6m: the tile is size x size·√3', () => {
  const s = at('p6m', true);
  const vb = s.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
  assert.ok(Math.abs(Number(vb[2]) - params.size * Math.sqrt(3)) < 1, vb[0]);
});

test('on, tree: not a symmetry kind, unchanged', () => {
  assert.equal(at('tree', true), at('tree', false));
});

test('wheel: the image border lies outside the tile, so its edge draws no line at the repeat', async () => {
  const { wheel } = await import('./state.ts');
  at('p4m', true);
  params.size = 120;
  colorSym.render = 'wheel';
  wheel.value = { dataUrl: 'data:image/webp;base64,AA', type: 'image/webp', bytes: 2, seam: 1, n: 256, pad: 1 };
  const s = svg.value;
  // 120 px tile, 256 + 2 px image: offset 120 / 256 = 0.46875, width 120 + 2 · 0.46875 = 120.9375.
  assert.match(s, /x="-0\.46875" y="-0\.46875" width="120\.9375" height="120\.9375"/);
  colorSym.render = 'bands';
  wheel.value = null;
});
