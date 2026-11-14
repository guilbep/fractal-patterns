import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAMILIES, KINDS, MAX_DEPTH, geometry, tileAspect, type Kind } from '../fractal.ts';
import { safePathData } from '../motifgrid.ts';
import { MAX_DENSE, patternStamp, patternStampList } from './pattern-stamps.ts';

// The kinds over 6000 characters at depth 1, or drawn only with curves: they get the MAX_DENSE cap.
const DENSE = ['scales', 'cm', 'pmm', 'pmg', 'pgg', 'cmm', 'p4', 'p4m', 'p4g', 'p3', 'p3m1', 'p31m', 'p6', 'p6m', 'penrosearcs'];

// A copy of the stamp path before the dense kinds were added, to pin the 65 kinds that worked then.
function oldPath(kind: Kind): string | null {
  const h = 100 / tileAspect(kind);
  const s = 100 / Math.max(100, h);
  const [dx, dy] = [(100 - 100 * s) / 2, (100 - h * s) / 2];
  const n = (v: number) => String(+v.toFixed(1));
  for (let depth = Math.min(2, MAX_DEPTH[kind]); depth >= 1; depth--) {
    const d = geometry({ kind, seed: 1, depth, size: 100 })
      .filter((p) => p.length >= 2)
      .map((p) => p.map(([x, y], i) => `${i ? 'L' : 'M'} ${n(x * s + dx)} ${n(y * s + dy)}`).join(' '))
      .join(' ');
    if (d.length > 6000) continue;
    return d && safePathData(d) === d ? d : null;
  }
  return null;
}

test('patternStamp: the 65 kinds that worked before keep the same path', () => {
  const old = KINDS.filter((k) => !DENSE.includes(k));
  assert.equal(old.length, 65);
  for (const kind of old) assert.equal(patternStamp(kind, 1)?.parts[0]?.d, oldPath(kind), kind);
});

test('patternStamp: every kind gives one clean stroke part inside the box', () => {
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
    assert.ok(d.length <= (DENSE.includes(kind) ? MAX_DENSE : 6000), kind);
    assert.ok(d.startsWith('M'), kind);
    assert.ok(!d.includes('<'), kind);
    for (const v of (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)) {
      assert.ok(Number.isFinite(v) && v >= -1 && v <= 101, `${kind}: ${v}`);
    }
  }
  assert.equal(MAX_DENSE, 20000);
  assert.equal(KINDS.length - missing.length, 80, missing.join(', '));
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
