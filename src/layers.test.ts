import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gcd, PHI, repeatDistance, secondSize } from './layers.ts';

test('secondSize vectors', () => {
  const vectors: [number, number][] = [
    [120, 193],
    [100, 161],
    [64, 103],
    [40, 63],
    [180, 293],
    [240, 389],
    [150, 241],
  ];
  for (const [s, want] of vectors) assert.equal(secondSize(s), want, `secondSize(${s})`);
});

test('gcd', () => {
  assert.equal(gcd(120, 193), 1);
});

test('secondSize from 40 to 240: larger, coprime, near size * PHI', () => {
  for (let s = 40; s <= 240; s++) {
    const t = secondSize(s);
    assert.ok(t > s, `${s} -> ${t}`);
    assert.equal(gcd(s, t), 1, `${s} -> ${t}`);
    assert.ok(Math.abs(t - s * PHI) < 12, `${s} -> ${t}`);
  }
});

test('repeatDistance is the least common multiple', () => {
  assert.equal(repeatDistance(120, 193), 23160);
  assert.equal(repeatDistance(100, 150), 300);
});
