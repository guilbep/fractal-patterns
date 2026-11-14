import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, KIND_FAMILY, MAX_DEPTH, generate, geometry, tileAspect, type Kind } from './fractal.ts';
import { MEASURED_DEPTH, preferred } from './preferred.ts';
import { canVary } from './supertile.ts';

test('preferred: every kind has a stroke on the slider (0.5..6, step 0.5) and a depth in 1..MAX_DEPTH', () => {
  for (const kind of KINDS) {
    const p = preferred(kind);
    assert.ok(p.stroke >= 0.5 && p.stroke <= 6 && Number.isInteger(p.stroke * 2), kind);
    assert.ok(Number.isInteger(p.depth) && p.depth >= 1 && p.depth <= MAX_DEPTH[kind], kind);
    assert.equal(typeof p.variants, 'boolean', kind);
  }
});

test('preferred: stroke by family, Truchet bold, Sprigs fine', () => {
  for (const kind of KINDS) {
    const f = KIND_FAMILY[kind];
    if (f === 'symmetry') assert.equal(preferred(kind).stroke, 0.5, kind);
    if (f === 'surface' || f === 'theme') assert.equal(preferred(kind).stroke, 1, kind);
  }
  assert.equal(preferred('truchet').stroke, 5);
  assert.equal(preferred('truchet').depth, 4);
  assert.equal(preferred('sprigs').stroke, 1);
});

test('preferred: Reduce repetition on for kinds that can vary in Fractals, Line art and Surfaces only', () => {
  for (const kind of KINDS) {
    const on = canVary(kind) && ['fractal', 'line', 'surface'].includes(KIND_FAMILY[kind]);
    assert.equal(preferred(kind).variants, on, kind);
  }
  assert.equal(preferred('carpet').variants, true);
  assert.equal(preferred('p4').variants, false);
});

// The measurement behind MEASURED_DEPTH (docs/research/preferred-settings.md), run again.
const SIZE = 120;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const TARGET = 0.088; // sqrt(0.052 * 0.147): Truchet at depth 4 and Honeycomb at depth 3
const MAX_CHARS = 20_000;
function density(kind: Kind, depth: number): number {
  let sum = 0;
  for (const seed of SEEDS)
    for (const p of geometry({ kind, seed, depth, size: SIZE }))
      for (let i = 1; i < p.length; i++) sum += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
  return sum / SEEDS.length / ((SIZE * SIZE) / tileAspect(kind));
}
const chars = (kind: Kind, depth: number): number =>
  Math.max(
    ...SEEDS.map((seed) => generate({ kind, seed, depth, size: SIZE, strokeWidth: 1, precision: 1, color: '#336699', opacity: 1 }).length),
  );

test('preferred: the depth table equals the measurement', () => {
  const measured: Record<string, number> = {};
  for (const kind of KINDS) {
    const lengthOf: Kind = kind === 'penrosearcs' ? 'penrose' : kind; // its arcs are raw path data, not polylines
    let best = { depth: 1, score: Infinity };
    for (let depth = 1; depth <= MAX_DEPTH[kind]; depth++) {
      if (chars(kind, depth) > MAX_CHARS) continue;
      const score = Math.abs(Math.log(density(lengthOf, depth) / TARGET));
      if (score < best.score) best = { depth, score };
    }
    measured[kind] = best.depth;
  }
  assert.deepEqual(measured, { ...MEASURED_DEPTH });
});
