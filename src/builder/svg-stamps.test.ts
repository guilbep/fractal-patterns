import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePathData } from '../motifgrid.ts';
import { motifBounds } from '../studio/motifs.ts';
import { stampFromSvg } from './svg-stamps.ts';
import type { Stamp } from './types.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const checkClean = (s: Stamp) => {
  for (const p of s.parts) {
    assert.ok(!p.d.includes('<'), p.d);
    assert.equal(safePathData(p.d), p.d);
    assert.match(p.color, HEX);
  }
};

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
