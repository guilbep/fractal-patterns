import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, geometry, svgFromPolylines } from './fractal.ts';
import { VARIANT_KINDS, superTileBytes, superTileSvg } from './supertile.ts';
import { VARIANT_DEFAULTS, variantTile, variantsActive } from './variants.ts';

const on = { variants: true, kind: 'tree', layout: 'single', usingImage: false } as const;

test('variantsActive: switch on, a kind that can vary, single pattern mode', () => {
  for (const kind of VARIANT_KINDS) assert.equal(variantsActive({ ...on, kind }), true, kind);
  assert.equal(variantsActive({ ...on, kind: 'maze' }), false);
  assert.equal(variantsActive({ ...on, layout: 'patchwork' }), false);
  // A traced image always can: every cell holds the same picture.
  assert.equal(variantsActive({ ...on, usingImage: true, kind: 'maze', layout: 'patchwork' }), true);
  assert.equal(variantsActive({ ...on, variants: false }), false);
});

const opts = { kind: 'tree', seed: 1, depth: 4, size: 120, strokeWidth: 2, precision: 1, color: '#336699', opacity: 0.6 } as const;

test('the variant tile is the super tile and its edge is 4 cells', () => {
  const t = variantTile(opts);
  assert.equal(t.svg, superTileSvg(opts));
  assert.equal(t.size, 4 * opts.size);
});

test('the variant tile edge is the cell count times the cell size', () => {
  for (const [cells, count] of [
    [2, 2],
    [4, 4],
    [6, 4],
    [6, 6],
  ] as const)
    assert.equal(variantTile({ ...opts, cells, count }).size, cells * opts.size);
});

test('the default variant options give the same tile as no options, byte for byte', () => {
  for (const seed of [1, 2, 99]) {
    const o = { ...opts, seed };
    assert.equal(variantTile({ ...o, ...VARIANT_DEFAULTS }).svg, superTileSvg(o));
    assert.deepEqual(superTileBytes({ ...o, ...VARIANT_DEFAULTS }), superTileBytes(o));
  }
});

test('with the switch off the single tile is the generate output, in the free layout', () => {
  // state.ts builds the off tile as svgFromPolylines(geometry(params)), with no compat flag.
  assert.equal(svgFromPolylines(geometry(opts), opts), generate(opts));
  const brick = { ...opts, kind: 'brick' } as const;
  assert.equal(svgFromPolylines(geometry(brick), brick), generate({ ...brick, compat: false }));
  const differs = [1, 2, 3, 4, 5].some((seed) => generate({ ...brick, seed }) !== generate({ ...brick, seed, compat: true }));
  assert.ok(differs, 'the free brick layout differs from the compatible one');
});
