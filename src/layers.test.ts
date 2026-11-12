import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveOpacity, gcd, layeredWorst, PHI, repeatDistance, secondSize } from './layers.ts';
import { worstTextContrast } from './pairing.ts';

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

test('effectiveOpacity', () => {
  for (const o of [0, 0.25, 0.6, 1]) {
    assert.equal(effectiveOpacity(o, 1), o);
    assert.ok(Math.abs(effectiveOpacity(o, 2) - (1 - (1 - o) ** 2)) < 1e-12);
  }
  assert.equal(effectiveOpacity(0, 2), 0);
  assert.equal(effectiveOpacity(1, 2), 1);
});

test('a second layer never raises the worst text contrast (20 seeded role sets)', () => {
  let a = 7;
  const r = () => (a = (a * 1103515245 + 12345) >>> 0) / 4294967296;
  const hex = () =>
    `#${Math.floor(r() * 0x1000000)
      .toString(16)
      .padStart(6, '0')}`;
  for (let i = 0; i < 20; i++) {
    const roles = { background: hex(), pattern: hex(), text: hex() };
    const o = r();
    const one = layeredWorst((x) => worstTextContrast(roles, x), o, 1);
    const two = layeredWorst((x) => worstTextContrast(roles, x), o, 2);
    assert.equal(one, worstTextContrast(roles, o));
    assert.ok(two <= one, `${i}`);
  }
});
