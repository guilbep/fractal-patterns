import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { safePathData } from '../motifgrid.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS, motifBounds } from '../studio/motifs.ts';
import { SEA_FAMILIES, SEA_LABELS } from '../studio/motifs-sea.ts';
import { ORCHARD_FAMILIES, ORCHARD_LABELS } from '../studio/motifs-orchard.ts';
import { BASIC_STAMPS, stampFromShapes, stampFromSvg, studioStamps } from './stamps.ts';
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

test('studioStamps: 18 family stamps, deterministic', () => {
  const a = studioStamps(1);
  assert.equal(a.length, 18);
  assert.deepEqual(
    a.map((s) => s.name),
    [
      ...MOTIF_FAMILIES.map((f) => MOTIF_LABELS[f]),
      ...SEA_FAMILIES.map((f) => SEA_LABELS[f]),
      ...ORCHARD_FAMILIES.map((f) => ORCHARD_LABELS[f]),
    ],
  );
  for (const s of a) {
    assert.ok(s.parts.length === 1 || s.parts.length === 2, s.name);
    assert.equal(s.parts[0]!.paint, 'fill');
    checkClean(s);
  }
  assert.ok(a.filter((s) => s.parts.length === 2).length >= 15);
  assert.deepEqual(studioStamps(1), a);
  assert.notDeepEqual(studioStamps(2), a);
});

test('stampFromSvg: a red square', () => {
  const s = stampFromSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ff0000" d="M2 2h20v20H2z"/></svg>',
    'red square.svg',
  );
  assert.ok(s);
  assert.equal(s.name, 'red square');
  assert.equal(s.parts.length, 1);
  assert.equal(s.parts[0]!.color.toLowerCase(), '#ff0000');
  assert.equal(s.parts[0]!.paint, 'fill');
  const b = motifBounds(s.parts[0]!.d);
  assert.ok(b.minX >= 0 && b.minY >= 0 && b.maxX <= s.box && b.maxY <= s.box, JSON.stringify(b));
  checkClean(s);
});

test('stampFromSvg: two fills keep file order', () => {
  const s = stampFromSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#00ff00" d="M2 2h8v8H2z"/><path fill="#0000ff" d="M12 12h8v8h-8z"/></svg>',
    'two',
  );
  assert.ok(s);
  assert.deepEqual(
    s.parts.map((p) => p.color.toLowerCase()),
    ['#00ff00', '#0000ff'],
  );
  checkClean(s);
});

test('stampFromSvg: rejects non-SVG and script-only files', () => {
  assert.equal(stampFromSvg('not an svg', 'x'), null);
  assert.equal(stampFromSvg('<svg><script>alert(1)</script></svg>', 'x'), null);
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
