import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fiberPixels, type FiberKind } from './fibers.ts';

const KINDS: FiberKind[] = ['washi', 'kraft'];
const base = { scale: 1, strength: 70, background: '#c8b89a', colors: ['#333333', '#8a5a2b'] };

// Mean abs RGB difference between pixel lines a and b; col = true compares columns.
const lineDiff = (px: Uint8ClampedArray, n: number, a: number, b: number, col: boolean) => {
  let sum = 0;
  for (let t = 0; t < n; t++) {
    const p = col ? (t * n + a) * 4 : (a * n + t) * 4;
    const q = col ? (t * n + b) * 4 : (b * n + t) * 4;
    for (let c = 0; c < 3; c++) sum += Math.abs(px[p + c]! - px[q + c]!);
  }
  return sum / (n * 3);
};

test('wraps: the edge seam is no stronger than an interior step', () => {
  const n = 256;
  for (const kind of KINDS)
    for (let seed = 1; seed <= 3; seed++) {
      const px = fiberPixels(kind, { ...base, n, seed });
      for (const col of [true, false]) {
        let inner = 0;
        for (let i = 1; i < n - 2; i++) inner += lineDiff(px, n, i, i + 1, col);
        inner /= n - 3;
        const seam = lineDiff(px, n, 0, n - 1, col);
        assert.ok(seam <= 1.5 * inner, `${kind} seed ${seed} ${col ? 'cols' : 'rows'}: ${seam} > 1.5 * ${inner}`);
      }
    }
});

test('a stroke crossing the right edge continues at x = 0', () => {
  const n = 64;
  const bg = [0xc8, 0xb8, 0x9a];
  const px = fiberPixels('kraft', {
    ...base,
    n,
    seed: 1,
    strength: 100,
    paths: [
      [
        [n - 8, 32],
        [n + 8, 32],
      ],
    ],
  });
  const at = (x: number, y: number) => (y * n + x) * 4;
  for (let x = 0; x < 6; x++) assert.ok(px[at(x, 32)]! < bg[0]! - 10, `x=${x} not darker: ${px[at(x, 32)]}`);
  for (let c = 0; c < 3; c++) assert.equal(px[at(2, 10) + c], bg[c]);
});

test('deterministic per seed, different across seeds', () => {
  for (const kind of KINDS) {
    const a = fiberPixels(kind, { ...base, n: 64, seed: 5 });
    assert.deepEqual(a, fiberPixels(kind, { ...base, n: 64, seed: 5 }));
    assert.notDeepEqual(a, fiberPixels(kind, { ...base, n: 64, seed: 6 }));
  }
});

test('strength 0 is the plain background; opaque; right length', () => {
  for (const kind of KINDS) {
    const n = 64;
    const px = fiberPixels(kind, { ...base, n, seed: 1, strength: 0 });
    assert.equal(px.length, n * n * 4);
    for (let i = 0; i < px.length; i += 4) assert.deepEqual([...px.subarray(i, i + 4)], [0xc8, 0xb8, 0x9a, 255]);
    const full = fiberPixels(kind, { ...base, n, seed: 1 });
    for (let i = 3; i < full.length; i += 4) assert.equal(full[i], 255);
  }
});

test('timing at n = 256', () => {
  for (const kind of KINDS) {
    const t0 = performance.now();
    fiberPixels(kind, { ...base, seed: 1, strength: 100, scale: 2 });
    const ms = performance.now() - t0;
    console.log(`${kind}: ${ms.toFixed(1)} ms (strength 100, scale 2)`);
    assert.ok(ms < 600);
  }
});
