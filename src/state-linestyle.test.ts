import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const { params, roles, svg, lineStyle, lineStyleReady, lineStyleOffReason, interlace, interlaceReady, reset } = await import('./state.ts');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const at = (kind: string, seed: number, depth: number, style: 'even' | 'brush' | 'hand'): string => {
  Object.assign(params, { kind, seed, depth });
  lineStyle.value = style;
  return svg.value;
};
const fills = (s: string) => [...s.matchAll(/<path d="[^"]*" fill="(#[0-9a-f]{6})" fill-opacity="[\d.]+" fill-rule="nonzero"\/>/g)];

test('even: the p4m tile is unchanged (pinned before Line style)', () => {
  const s = at('p4m', 7, 8, 'even');
  assert.equal(s.length, 8479);
  assert.equal(sha(s), 'f719039a83e397a1');
});

test('brush on truchet: filled non-zero outlines in the stroke colour replace the stroked lines', async () => {
  const even = at('truchet', 1, 4, 'even');
  at('truchet', 1, 4, 'brush');
  await lineStyleReady();
  const s = at('truchet', 1, 4, 'brush');
  assert.notEqual(s, even);
  assert.equal(s.slice(0, s.indexOf('>') + 1), even.slice(0, even.indexOf('>') + 1));
  const f = fills(s);
  assert.equal(f.length, 1);
  assert.equal(f[0]![1], roles.pattern);
  assert.ok(!s.includes('stroke='), 'no stroked polyline left');
  // Seeded: the same design gives the same tile.
  assert.equal(at('truchet', 1, 4, 'brush'), s);
});

test('hand on star-hex: the hexagonal tile is squeezed and drawn at full height', async () => {
  const even = at('star-hex', 1, 2, 'even');
  await lineStyleReady();
  const s = at('star-hex', 1, 2, 'hand');
  assert.equal(s.slice(0, s.indexOf('>') + 1), even.slice(0, even.indexOf('>') + 1));
  assert.equal(fills(s).length, 1);
  assert.ok(!s.includes('stroke='));
  const ys = [...s.matchAll(/M[\d.]+[ ,]?([\d.]+)/g)].map((m) => +m[1]!);
  const h = params.size * Math.sqrt(3);
  assert.ok(Math.max(...ys) > params.size * 1.1 && Math.max(...ys) <= h + 0.1, String(Math.max(...ys)));
  assert.notEqual(at('star-hex', 1, 2, 'brush'), s);
});

test('interlace on: line style gives its reason and the tile is the interlace one', async () => {
  at('star-488', 1, 2, 'even');
  interlace.on = true;
  await interlaceReady();
  const il = svg.value;
  assert.ok(il.includes('<g id="il"'));
  const s = at('star-488', 1, 2, 'brush');
  assert.equal(lineStyleOffReason.value, 'interlace');
  assert.equal(s, il);
  reset();
  assert.equal(lineStyle.value, 'even');
  assert.equal(interlace.on, false);
});
