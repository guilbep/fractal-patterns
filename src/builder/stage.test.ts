import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleTransform, hitStroke, viewBox } from './stage.ts';

const near = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('handleTransform turns clockwise with y down', () => {
  const r = handleTransform([0, 0], [10, 0], [0, 10], 0, 1);
  near(r.rotate, 90);
  near(r.scale, 1);
  near(handleTransform([0, 0], [10, 0], [0, -10], 0, 1).rotate, 270);
});

test('handleTransform scales by the distance ratio', () => {
  const r = handleTransform([0, 0], [10, 0], [20, 0], 30, 0.5);
  near(r.rotate, 30);
  near(r.scale, 1);
});

test('handleTransform snaps the rotation', () => {
  near(handleTransform([0, 0], [10, 0], [10, 2], 0, 1, 15).rotate, 15);
  near(handleTransform([0, 0], [10, 0], [10, 1], 0, 1, 15).rotate, 0);
});

test('handleTransform keeps the start values when start is the center', () => {
  assert.deepEqual(handleTransform([5, 5], [5, 5], [9, 9], 40, 2), { rotate: 40, scale: 2 });
});

test('handleTransform clamps the scale', () => {
  near(handleTransform([0, 0], [1, 0], [1000, 0], 0, 1).scale, 20);
  near(handleTransform([0, 0], [1, 0], [0.001, 0], 0, 1).scale, 0.05);
});

test('viewBox', () => {
  assert.equal(viewBox(240, 240), '-120 -120 480 480');
  assert.equal(viewBox(400, 200), '-200 -100 800 400');
});

test('hitStroke keeps a line at least minPixels wide on the screen', () => {
  near(hitStroke(3, 0.5), 7);
  near(hitStroke(10, 0.5), 10);
  near(hitStroke(3, 1, 20), 20);
  near(hitStroke(0, 0.9), 12.6);
});
