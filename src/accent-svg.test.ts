import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { accentDefaults, accentShapes } from './accent-layer.ts';
import { accentSvg } from './accent-svg.ts';
import { ACCENT_VARY_DEFAULTS, varyAccent } from './accent-vary.ts';

const count = (s: string, sub: string) => s.split(sub).length - 1;

test('4 dots on a grid: one shape in defs, 4 uses, no rotate or scale', () => {
  const layer = { on: true, shape: 'dot', size: 15, amount: 100, place: 'grid', snap: 4 } as const;
  const dots = accentShapes('tree', { ...layer, snap: 4 }, { seed: 1, depth: 4, size: 40 }).slice(0, 4);
  const svg = accentSvg(dots, undefined, 40, 40, '#e07a3f', 1);
  assert.equal(count(svg, '<path id='), 1);
  assert.equal(count(svg, '<use'), 4);
  assert.ok(!svg.includes('rotate(') && !svg.includes('scale('), svg);
  assert.ok(svg.includes('<g fill="#e07a3f" fill-rule="nonzero">'));
});

test('Truchet varied defaults: a use per shape, gzip under 5000 bytes', () => {
  const shapes = accentShapes('truchet', accentDefaults('truchet'), { seed: 7, depth: 4, size: 96 });
  const v = varyAccent(shapes, 96, 96, ACCENT_VARY_DEFAULTS, 7);
  const svg = accentSvg(shapes, v.places, v.width, v.height, '#e07a3f', 1);
  assert.equal(count(svg, '<use'), v.polys.length);
  assert.ok(gzipSync(svg).length < 5000, String(gzipSync(svg).length));
});

test('no copies: an empty tile', () => {
  assert.equal(
    accentSvg([], [], 10, 10, '#000', 1),
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10"></svg>',
  );
});
