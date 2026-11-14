import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const { params, svg } = await import('./state.ts');
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
