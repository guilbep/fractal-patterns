import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  badgeText,
  formatKb,
  co2Mg,
  DRIFT_WATTS,
  driftMgPerMinute,
  driftMultiple,
  formatFootprint,
  GRID_G_PER_KWH,
  gzipSize,
  rawSize,
  weightGrade,
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
    gzipSize(generate({ kind: 'tree', seed: 1, depth, size: 120, strokeWidth: 1, precision: 1, color: '#336699', opacity: 0.5 }));
  assert.ok((await at(3)) < (await at(MAX_DEPTH.tree)));
});

test('co2.ts uses no Node-only modules', () => {
  const src = readFileSync(join(import.meta.dirname, 'co2.ts'), 'utf8');
  assert.ok(!src.includes('zlib'));
  assert.ok(!src.includes('node:'));
});

test('formatKb: three significant digits', () => {
  assert.equal(formatKb(320), '0.313');
  assert.equal(formatKb(1987), '1.94');
  assert.equal(formatKb(12902), '12.6');
  assert.equal(formatKb(106496), '104');
  assert.equal(formatKb(2048000), '2000');
});

test('sizeLines: with a script, without, and computing', async () => {
  const { sizeLines } = await import('./co2.ts');
  const base = { css: 2365, svg: 1884, script: 0, gz: { css: 722, script: 0 } };
  assert.deepEqual(sizeLines(base), ['CSS: 2.31 KB, 0.705 KB compressed', 'SVG tile, as a file: 1.84 KB']);
  assert.deepEqual(sizeLines({ ...base, script: 422, gz: { css: 722, script: 215 } })[2], 'Script: 0.412 KB, 0.210 KB compressed');
  assert.deepEqual(sizeLines({ ...base, script: 422, gz: null }), [
    'CSS: 2.31 KB, computing',
    'SVG tile, as a file: 1.84 KB',
    'Script: 0.412 KB, computing',
  ]);
});

test('weightGrade boundaries', async () => {
  const { weightGrade, WEIGHT_GRADES, GRADE_SCALE, gradeLine } = await import('./co2.ts');
  const cases: [number, string][] = [
    [0, 'A+'],
    [1023, 'A+'],
    [1024, 'A'],
    [2047, 'A'],
    [2048, 'B'],
    [5119, 'B'],
    [5120, 'C'],
    [10239, 'C'],
    [10240, 'D'],
    [20479, 'D'],
    [20480, 'E'],
    [1e12, 'E'],
  ];
  for (const [b, g] of cases) assert.equal(weightGrade(b).grade, g, String(b));
  assert.equal(weightGrade(1500).limitKb, 2);
  assert.equal(weightGrade(1e12).limitKb, null);
  const limits = WEIGHT_GRADES.map((w) => w.limitKb);
  assert.equal(limits.at(-1), null);
  for (let i = 1; i < limits.length - 1; i++) assert.ok((limits[i] as number) > (limits[i - 1] as number));
  assert.equal(limits.filter((l) => l === null).length, 1);
  assert.equal(
    GRADE_SCALE,
    "This is the tool's own scale: A+ under 1 KB, A under 2, B under 5, C under 10, D under 20, E above. It is not the Website Carbon rating, which rates a whole page.",
  );
  assert.equal(gradeLine(1987), 'Weight grade A: under 2 KB compressed.');
  assert.equal(gradeLine(30000), 'Weight grade E: 20 KB compressed or more.');
});

test('badgeText: one wording for the size badge on every page', () => {
  const t = badgeText(2917);
  assert.equal(t.size, '2.8 kB');
  assert.equal(`≈ ${t.co2}`, formatFootprint(2917).split(' / ')[0]);
  assert.equal(t.grade, weightGrade(2917).grade);
  assert.equal(t.grade, 'B');
  assert.deepEqual(badgeText(null), { grade: null, size: 'compressing', co2: '' });
  assert.deepEqual(badgeText('unknown'), { grade: null, size: 'gzip size unknown', co2: '' });
});
