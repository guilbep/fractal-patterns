import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextStep, shouldShowCoach } from './coach.ts';

test('the coach shows on a first visit only', () => {
  assert.equal(shouldShowCoach(null, true, false), true);
  assert.equal(shouldShowCoach('done', true, false), false);
  assert.equal(shouldShowCoach(null, false, false), false);
  assert.equal(shouldShowCoach(null, true, true), false);
});

test('the steps run 0, 1, 2, then end', () => {
  assert.equal(nextStep(0), 1);
  assert.equal(nextStep(1), 2);
  assert.equal(nextStep(2), null);
});
