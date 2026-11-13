import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellOrder, handleTransform, hitStroke, itemsInRect, snapPoint, stepSelection, viewBox } from './stage.ts';

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

test('stepSelection steps through the ids and wraps around', () => {
  assert.equal(stepSelection([5, 7, 9], null, 1), 5);
  assert.equal(stepSelection([5, 7, 9], null, -1), 9);
  assert.equal(stepSelection([5, 7, 9], 7, 1), 9);
  assert.equal(stepSelection([5, 7, 9], 9, 1), 5);
  assert.equal(stepSelection([5, 7, 9], 5, -1), 9);
  assert.equal(stepSelection([5, 7, 9], 42, 1), 5);
  assert.equal(stepSelection([], null, 1), null);
  assert.equal(stepSelection([4], 4, 1), 4);
});

test('snapPoint rounds to the grid and wraps into the tile', () => {
  assert.deepEqual(snapPoint(31, 44, 240, 240, 8), [30, 30]);
  assert.deepEqual(snapPoint(239, 1, 240, 240, 8), [0, 0]);
  assert.deepEqual(snapPoint(-14, 50, 240, 120, 4), [0, 60]);
  assert.deepEqual(snapPoint(45, 45, 240, 240, 8), [60, 60]);
});

test('cellOrder draws the row above first', () => {
  const rows = cellOrder().map(([, oy]) => oy);
  assert.deepEqual(rows, [-1, -1, -1, 0, 0, 0, 1, 1, 1]);
  assert.equal(new Set(cellOrder().map((c) => c.join())).size, 9);
});

test('itemsInRect finds centers in the rectangle, wrapped centers too', () => {
  const items = [
    { id: 1, x: 10, y: 10 },
    { id: 2, x: 100, y: 100 },
    { id: 3, x: 190, y: 50 },
  ];
  assert.deepEqual(itemsInRect(items, { x0: 0, y0: 0, x1: 50, y1: 60 }, 200, 200), [1]);
  assert.deepEqual(itemsInRect(items, { x0: 180, y0: 40, x1: 220, y1: 60 }, 200, 200), [3]);
  assert.deepEqual(itemsInRect(items, { x0: -20, y0: 40, x1: 20, y1: 60 }, 200, 200), [3]);
});
