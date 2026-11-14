import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';

// state.ts imports through the Vite alias '@/'; map it to src/ for node.
const src = new URL('./', import.meta.url).href;
registerHooks({ resolve: (s, c, next) => next(s.startsWith('@/') ? src + s.slice(2) : s, c) });
const { params, svg, grain, texture, setTextureKind, textureReady, textureOut, checkedRoles, roles } = await import('./state.ts');
const { exportText } = await import('./state-export.ts');
const { GRAIN_DEFAULTS } = await import('./grain.ts');
const { TEXTURE_DEFAULTS } = await import('./texture.ts');

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const at = (kind: string) => {
  Object.assign(texture, TEXTURE_DEFAULTS);
  Object.assign(grain, GRAIN_DEFAULTS);
  params.kind = kind as typeof params.kind;
  params.seed = 7;
  params.depth = 8; // as pinned: read before the kind watch clamps it
};

// Pinned before the texture layer existed: [svg length, svg sha, css length, css sha].
const PINS = {
  p4m: { off: [8479, 'f719039a83e397a1', 9566, '3dcb21d3b68565f7'], grain: [8965, '4bdf0456b508756b', 10193, 'bd496f897a49e926'] },
  tree: { off: [3508, '70369bfaf37cf8ac', 4571, 'c679cc651dd71140'], grain: [3994, '3ddbff7afca554da', 5198, '105e13505270c5d4'] },
};
const pin = () => [svg.value.length, sha(svg.value), exportText.value.length, sha(exportText.value)];

for (const kind of ['p4m', 'tree'] as const) {
  test(`${kind}: off and grain (gr=12_0.75_d) are byte-identical to before`, () => {
    at(kind);
    assert.deepEqual(pin(), PINS[kind].off);
    Object.assign(grain, { on: true, amount: 12, size: 0.75, tone: 'dark' });
    assert.deepEqual(pin(), PINS[kind].grain);
  });
}

test('paper, live: a filter layer under the pattern in the CSS and in the file', async () => {
  at('p4m');
  setTextureKind('paper');
  texture.route = 'live';
  await textureReady();
  assert.ok(textureOut.value!.svg.includes('<filter'));
  assert.equal(textureOut.value!.tile, 257);
  const css = exportText.value;
  const layer = css.indexOf('background-image: var(--fp-grain)');
  assert.ok(layer > 0 && layer < css.indexOf('.fp-pattern::before'));
  assert.ok(css.includes('--fp-grain-size: 257px;'));
  assert.ok(svg.value.includes('filter'));
  // Live bound: black over the background at the rect's peak opacity, 0.2 * 40 % for paper.
  const t = checkedRoles.value.texture!;
  assert.equal(t.length, 1);
  assert.notEqual(t[0], roles.background);
});

test('terrazzo, vector: paths, palette colours as the contrast bound', async () => {
  at('tree');
  setTextureKind('terrazzo');
  await textureReady();
  assert.equal(texture.route, 'vector');
  assert.ok(textureOut.value!.svg.includes('<path'));
  assert.equal(textureOut.value!.tile, 241);
  assert.equal(checkedRoles.value.texture!.length, 5);
  assert.ok(svg.value.includes('<path'));
});

test('one texture layer: setTextureKind and the grain switch are exclusive', () => {
  at('tree');
  setTextureKind('sand');
  assert.deepEqual([texture.on, texture.kind, texture.route, grain.on], [true, 'sand', 'live', false]);
  setTextureKind('grain');
  assert.deepEqual([texture.on, grain.on], [false, true]);
  setTextureKind('stipple');
  assert.deepEqual([texture.on, grain.on], [true, false]);
  grain.on = true; // the existing grain switch
  assert.equal(texture.on, false);
  assert.equal(checkedRoles.value.texture, null);
  assert.equal(textureOut.value, null);
});
