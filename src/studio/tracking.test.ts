import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Pt } from '../patterns/util.ts';
import { trackingScore, type TrackCircle } from './tracking.ts';

const S = 300;
const r = 20;
// Five motifs: one column, and a 5-spot layout (one per row and per column).
const column: TrackCircle[] = [0, 1, 2, 3, 4].map((i) => ({ c: [150, 30 + i * 60] as Pt, r }));
const spread: TrackCircle[] = [0, 1, 2, 3, 4].map((i) => ({ c: [30 + i * 60, 30 + ((i * 2) % 5) * 60] as Pt, r }));
const score = (circles: TrackCircle[]) => trackingScore({ circles, stems: [] }, 'straight', S, S);

test('a vertical column scores much worse than a 5-spot layout', () => {
  assert.ok(score(column).score > 2 * score(spread).score, `${score(column).score} vs ${score(spread).score}`);
});

test('the same column turned horizontal scores better than vertical', () => {
  const row = column.map((c) => ({ c: [c.c[1], c.c[0]] as Pt, r }));
  assert.ok(score(row).score < score(column).score);
});

test('removing a block of motifs raises the hole measure', () => {
  const grid: TrackCircle[] = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) grid.push({ c: [25 + i * 50, 25 + j * 50], r });
  const holed = grid.filter((c) => !(c.c[0] < 150 && c.c[1] < 150));
  assert.ok(score(holed).hole > score(grid).hole + 0.1);
});

test('the score is the same after a shift by a lattice vector (torus)', () => {
  for (const repeat of ['straight', 'half-drop', 'brick'] as const) {
    const v: Pt = repeat === 'half-drop' ? [S, S / 2] : repeat === 'brick' ? [S / 2, S] : [S, S];
    const a = trackingScore({ circles: spread, stems: [] }, repeat, S, S);
    const b = trackingScore({ circles: spread.map((c) => ({ c: [c.c[0] + v[0], c.c[1] + v[1]] as Pt, r })), stems: [] }, repeat, S, S);
    assert.ok(Math.abs(a.score - b.score) < 1e-9 && Math.abs(a.hole - b.hole) < 1e-9, repeat);
  }
});
