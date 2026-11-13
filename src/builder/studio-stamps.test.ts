import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safePathData } from '../motifgrid.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS } from '../studio/motifs.ts';
import { SEA_FAMILIES, SEA_LABELS } from '../studio/motifs-sea.ts';
import { ORCHARD_FAMILIES, ORCHARD_LABELS } from '../studio/motifs-orchard.ts';
import { studioStamps } from './studio-stamps.ts';
import type { Stamp } from './types.ts';

const HEX = /^#[0-9a-f]{6}$/i;
const checkClean = (s: Stamp) => {
  for (const p of s.parts) {
    assert.ok(!p.d.includes('<'), p.d);
    assert.equal(safePathData(p.d), p.d);
    assert.match(p.color, HEX);
  }
};

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
