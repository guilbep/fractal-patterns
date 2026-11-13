import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safePathData } from '../motifgrid.ts';
import { motifBounds } from '../studio/motifs.ts';
import { BASIC_STAMPS, stampFromShapes } from './stamps.ts';
import type { Stamp } from './types.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const checkClean = (s: Stamp) => {
  for (const p of s.parts) {
    assert.ok(!p.d.includes('<'), p.d);
    assert.equal(safePathData(p.d), p.d);
    assert.match(p.color, HEX);
  }
};

test('BASIC_STAMPS: 12 named shapes inside the box', () => {
  const names = ['Dot', 'Ring', 'Square', 'Triangle', 'Diamond', 'Drop', 'Leaf', 'Petal arch', 'Dash', 'Wave', 'Zigzag', 'Plus'];
  assert.deepEqual(
    BASIC_STAMPS.map((s) => s.name),
    names,
  );
  assert.equal(new Set(names).size, 12);
  const paints = BASIC_STAMPS.map((s) => s.parts[0]!.paint);
  assert.deepEqual(paints, ['fill', 'stroke', 'fill', 'fill', 'fill', 'fill', 'fill', 'fill', 'stroke', 'stroke', 'stroke', 'stroke']);
  for (const s of BASIC_STAMPS) {
    assert.equal(s.box, 100);
    assert.equal(s.parts.length, 1);
    const d = s.parts[0]!.d;
    assert.notEqual(safePathData(d), null, s.name);
    assert.ok(d.length <= 200, s.name);
    const b = motifBounds(d);
    assert.ok(b.minX >= 4 && b.minY >= 4 && b.maxX <= 96 && b.maxY <= 96, `${s.name} ${JSON.stringify(b)}`);
    checkClean(s);
  }
});

test('stampFromShapes: traced fills', () => {
  const s = stampFromShapes([{ color: '#112233', d: 'M0 0h10v10H0z' }], 100, 'trace');
  assert.ok(s);
  assert.deepEqual(s.parts, [{ d: 'M0 0h10v10H0z', paint: 'fill', color: '#112233' }]);
  assert.equal(stampFromShapes([], 100, 'x'), null);
  assert.equal(stampFromShapes([{ color: '#112233', d: '<x>' }], 100, 'x'), null);
  const t = stampFromShapes(
    [
      { color: '#112233', d: '<x>' },
      { color: 'red', d: 'M0 0h1v1z' },
    ],
    100,
    'y',
  );
  assert.ok(t);
  assert.deepEqual(t.parts, [{ d: 'M0 0h1v1z', paint: 'fill', color: '#333333' }]);
});

test('stamps.ts source hygiene', () => {
  const src = readFileSync(new URL('./stamps.ts', import.meta.url), 'utf8');
  for (const w of ['Math.random', 'Date', 'document', 'window']) assert.ok(!src.includes(w), w);
});

test('stamps.ts imports no studio motif generator and no SVG importer (they load on demand)', () => {
  const src = readFileSync(new URL('./stamps.ts', import.meta.url), 'utf8');
  assert.ok(!/from '\.\.\/studio\/(motifs|svg-import)/.test(src));
});
