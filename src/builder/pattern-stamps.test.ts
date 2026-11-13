import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAMILIES, KINDS } from '../fractal.ts';
import { safePathData } from '../motifgrid.ts';
import { patternStamp, patternStampList } from './pattern-stamps.ts';

test('patternStamp: every kind gives null or one clean stroke part inside the box', () => {
  const missing: string[] = [];
  for (const kind of KINDS) {
    const s = patternStamp(kind, 1);
    if (!s) {
      missing.push(kind);
      continue;
    }
    assert.equal(s.box, 100);
    assert.equal(s.parts.length, 1, kind);
    const { d, paint } = s.parts[0]!;
    assert.equal(paint, 'stroke');
    assert.equal(safePathData(d), d, kind);
    assert.ok(d.length <= 6000, kind);
    assert.ok(d.startsWith('M'), kind);
    assert.ok(!d.includes('<'), kind);
    for (const v of (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)) {
      assert.ok(Number.isFinite(v) && v >= -1 && v <= 101, `${kind}: ${v}`);
    }
  }
  assert.ok(KINDS.length - missing.length >= 63, missing.join(', '));
});

test('patternStamp: deterministic, and the seed matters', () => {
  for (const k of ['seigaiha', 'penrose', 'hex', 'waves', 'dots'] as const) assert.deepEqual(patternStamp(k, 1), patternStamp(k, 1));
  assert.notDeepEqual(patternStamp('waves', 1), patternStamp('waves', 2));
});

test('patternStampList: families in order, every kind once, none empty', () => {
  const list = patternStampList();
  assert.deepEqual(
    list.map((g) => g.family),
    [...FAMILIES],
  );
  for (const g of list) assert.ok(g.kinds.length > 0, g.family);
  assert.deepEqual(list.flatMap((g) => g.kinds.map((k) => k.kind)).sort(), [...KINDS].sort());
});

test('pattern-stamps.ts: no randomness, clock or DOM', () => {
  const src = readFileSync(new URL('./pattern-stamps.ts', import.meta.url), 'utf8');
  for (const bad of ['Math.random', 'Date', 'document', 'window']) assert.ok(!src.includes(bad), bad);
});
