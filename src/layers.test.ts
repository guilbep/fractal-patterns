import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossOpacity, effectiveOpacity, gcd, layeredWorst, layerSpots, PHI, repeatDistance, secondSize } from './layers.ts';
import { fixForMode, plateContrast, worstAt, worstTextContrast } from './pairing.ts';
import { textLevel } from './contrast.ts';

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

test('secondSize from 40 to 320: larger, coprime, near size * PHI', () => {
  for (let s = 40; s <= 320; s++) {
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

test('crossOpacity: strength 1 gives the old value, strength 0 gives the first layer alone', () => {
  for (const o of [0, 0.25, 0.6, 1]) {
    assert.ok(Math.abs(crossOpacity(o, 1) - effectiveOpacity(o, 2)) < 1e-12);
    assert.equal(crossOpacity(o, 0), o);
    assert.ok(Math.abs(crossOpacity(o, 0.5) - (1 - (1 - o) * (1 - o * 0.5))) < 1e-12);
  }
  assert.deepEqual(layerSpots(0.6, 2), [0.6, effectiveOpacity(0.6, 2)]);
  assert.deepEqual(layerSpots(0.6, 1, 0.3), [0.6]);
});

test('Fix aims at the layered value the badge shows (20 seeded role sets, every mode)', () => {
  let a = 11;
  const r = () => (a = (a * 1103515245 + 12345) >>> 0) / 4294967296;
  const hex = () =>
    `#${Math.floor(r() * 0x1000000)
      .toString(16)
      .padStart(6, '0')}`;
  let fixed = 0;
  for (let i = 0; i < 20; i++) {
    const roles = { background: hex(), pattern: hex(), text: hex() };
    const o = 0.2 + r() * 0.8;
    const plate = r();
    const strength = 0.1 + r() * 0.9;
    const spots = (x: number) => layerSpots(x, 2, strength);
    for (const mode of ['plate', 'split', 'direct'] as const) {
      const f = fixForMode(mode, roles, o, plate, 4.5, spots);
      if (!f.reached) continue;
      fixed++;
      const after = { ...roles, text: f.text };
      // The badge: layeredWorst over the paragraph's surface, the plate except in 'direct'.
      const badge =
        mode === 'direct'
          ? layeredWorst((x) => worstTextContrast(after, x), f.opacity, 2, strength)
          : layeredWorst((x) => plateContrast(after, x, f.plate), f.opacity, 2, strength);
      assert.ok(badge >= 4.5, `${i} ${mode} ${badge}`);
      if (mode === 'split') assert.ok(layeredWorst((x) => worstTextContrast(after, x), f.opacity, 2, strength) >= 3, `${i} heading`);
    }
  }
  assert.ok(fixed >= 20, `${fixed}`);
});

// The badge as state.ts computes it after applyFix: worstAt or plateContrast over layerSpots, then textLevel.
test('Fix success means the badge passes: second layer at strength 0.5 (20 seeded role sets, every mode)', () => {
  let a = 23;
  const r = () => (a = (a * 1103515245 + 12345) >>> 0) / 4294967296;
  const hex = () =>
    `#${Math.floor(r() * 0x1000000)
      .toString(16)
      .padStart(6, '0')}`;
  const spots = (o: number) => layerSpots(o, 2, 0.5);
  let fixed = 0;
  for (let i = 0; i < 20; i++) {
    const roles = { background: hex(), pattern: hex(), text: hex() };
    const o = 0.2 + r() * 0.8;
    const plate = r();
    for (const mode of ['plate', 'split', 'direct'] as const) {
      const f = fixForMode(mode, roles, o, plate, 4.5, spots);
      if (!f.reached) continue;
      fixed++;
      const after = { ...roles, text: f.text };
      const direct = worstAt(after, f.opacity, spots);
      const worst = mode === 'direct' ? direct : plateContrast(after, f.opacity, f.plate, spots);
      assert.ok(worst >= 4.5, `${i} ${mode} ${worst} ${JSON.stringify(roles)} o=${o} plate=${plate}`);
      assert.notEqual(textLevel(worst), 'fail', `${i} ${mode}`);
      if (mode === 'split') assert.ok(direct >= 3, `${i} heading ${direct}`);
    }
  }
  assert.ok(fixed >= 20, `${fixed}`);
});
