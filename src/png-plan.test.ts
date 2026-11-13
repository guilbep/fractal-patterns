import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clockFadeStops, mayExceedMobileLimit, patternOffset, planStrips } from './png-plan.ts';

test('planStrips', () => {
  assert.deepEqual(planStrips(1206, 2622), { ok: true, strips: [{ y: 0, height: 2622 }] });
  assert.deepEqual(planStrips(3840, 2160), { ok: true, strips: [{ y: 0, height: 2160 }] });
  assert.deepEqual(planStrips(3508, 4961), {
    ok: true,
    strips: [
      { y: 0, height: 4782 },
      { y: 4782, height: 179 },
    ],
  });
  assert.equal(planStrips(20000, 100).ok, false);
});

test('mayExceedMobileLimit', () => {
  assert.equal(mayExceedMobileLimit(3508, 4961), true);
  assert.equal(mayExceedMobileLimit(3840, 2160), false);
});

test('clockFadeStops', () => {
  assert.deepEqual(clockFadeStops(2622), { from: 0, to: 839 });
});

test('patternOffset', () => {
  assert.equal(patternOffset(4782, 120), -102);
  assert.ok(Object.is(patternOffset(0, 120), 0));
});

test('png-plan.ts stays pure', () => {
  const src = readFileSync(new URL('./png-plan.ts', import.meta.url), 'utf8');
  for (const word of ['document', 'window', 'Math.random', 'Date']) assert.ok(!src.includes(word), word);
});
