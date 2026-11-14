import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftMgPerMinute } from './co2.ts';
import { costLevel, costText, liveMgPerMinute } from './draw-cost.ts';

test('10 ms per redraw, 60 redraws per minute: 0.3 J per minute is 0.04 mg', () => {
  assert.ok(Math.abs(liveMgPerMinute(10, 60) - 0.04) < 1e-9);
});

test('a layer busy all the time costs the same as drift', () => {
  assert.ok(Math.abs(liveMgPerMinute(1000, 60) - driftMgPerMinute()) < 1e-9);
  assert.ok(Math.abs(driftMgPerMinute() - 4) < 1e-9);
});

test('costLevel thresholds', () => {
  assert.equal(costLevel(null), 'none');
  assert.equal(costLevel(3.9), 'low');
  assert.equal(costLevel(4), 'high');
});

test('costText', () => {
  assert.deepEqual(costText({ onceBytes: 6758, live: null }), { once: 'Once: 6.6 kB', whileVisible: 'While visible: none' });
  assert.equal(
    costText({ onceBytes: 6758, live: { msPerRedraw: 10 } }).whileVisible,
    'While visible: high, ≈ 0.04 mg CO₂ per minute (estimate, measured on this device)',
  );
});
