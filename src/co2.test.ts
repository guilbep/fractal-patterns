import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  co2Mg,
  DRIFT_WATTS,
  driftMgPerMinute,
  driftMultiple,
  formatFootprint,
  GRID_G_PER_KWH,
  gzipSize,
  rawSize,
} from './co2.ts';
import { generate, KINDS, MAX_DEPTH } from './fractal.ts';

test('co2Mg vectors', () => {
  assert.equal(co2Mg(2017).toFixed(2), '0.39');
  assert.equal(co2Mg(5898.24).toFixed(2), '1.14');
  assert.equal(co2Mg(1000).toFixed(2), '0.19');
  assert.equal(co2Mg(0), 0);
});

test('co2Mg at the calibration point', () => {
  assert.ok(Math.abs(co2Mg(5.76 * 1024) - 1.144116732462) < 1e-12);
});

test('formatFootprint', () => {
  assert.equal(formatFootprint(2017), '≈ 0.4 mg CO₂ / visit · 1.97 KB compressed');
  assert.equal(formatFootprint(0), '≈ 0 mg CO₂ / visit · 0.00 KB compressed');
  assert.equal(formatFootprint(5898.24), '≈ 1.1 mg CO₂ / visit · 5.76 KB compressed');
  assert.equal(formatFootprint(200), '≈ 0.04 mg CO₂ / visit · 0.20 KB compressed');
  assert.equal(formatFootprint(60000), '≈ 11.6 mg CO₂ / visit · 58.59 KB compressed');
});

test('drift constants', () => {
  assert.equal(DRIFT_WATTS, 0.5);
  assert.equal(GRID_G_PER_KWH, 480);
});

test('driftMgPerMinute', () => {
  assert.ok(Math.abs(driftMgPerMinute() - 4) < 1e-9);
  assert.ok(Math.abs(driftMgPerMinute(1, 480) - 8) < 1e-9);
  assert.ok(Math.abs(driftMgPerMinute(0.5, 60) - 0.5) < 1e-9);
});

test('driftMultiple', () => {
  assert.ok(Math.abs(driftMultiple(0.4) - 10) < 1e-9);
  assert.equal(driftMultiple(0), 0);
  assert.ok(Math.abs(driftMultiple(0.4, 5) - 50) < 1e-9);
});

test('rawSize counts UTF-8 bytes', () => {
  assert.equal(rawSize('abc'), 3);
  assert.equal(rawSize('≈'), 3);
  assert.equal(rawSize(''), 0);
});

test('gzipSize vectors', async () => {
  assert.equal(await gzipSize(''), 20);
  assert.equal(await gzipSize('a'.repeat(10000)), 46);
});

test('gzipSize matches zlib on every kind at max depth', async () => {
  for (const kind of KINDS) {
    const svg = generate({
      kind,
      seed: 1,
      depth: MAX_DEPTH[kind],
      size: 120,
      strokeWidth: 1,
      precision: 1,
      color: '#336699',
      opacity: 0.5,
    });
    const size = await gzipSize(svg);
    assert.equal(size, gzipSync(svg).length, kind);
    assert.ok(size > 0, kind);
    assert.ok(size < rawSize(svg), kind);
  }
});

test('lower depth shrinks the gzipped tile', async () => {
  const at = (depth: number) =>
    gzipSize(
      generate({ kind: 'tree', seed: 1, depth, size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 }),
    );
  assert.ok((await at(3)) < (await at(MAX_DEPTH.tree)));
});

test('co2.ts uses no Node-only modules', () => {
  const src = readFileSync(join(import.meta.dirname, 'co2.ts'), 'utf8');
  assert.ok(!src.includes('zlib'));
  assert.ok(!src.includes('node:'));
});
