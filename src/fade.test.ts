import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fadeMask, fadeSizes } from './fade.ts';
import { gcd } from './layers.ts';

test('fadeMask is deterministic', () => {
  assert.deepEqual(fadeMask(120), fadeMask(120));
});

test('fade sizes: larger than 3 tiles and coprime', () => {
  for (const t of [40, 64, 100, 120, 193, 240]) {
    const [a, b] = fadeSizes(t);
    assert.ok(a > 3 * t && b > 3 * t, `${t}`);
    assert.equal(gcd(a, b), 1, `${t}`);
    assert.ok(fadeMask(t).some((l) => l === `mask-size: ${a}px ${a}px, ${b}px ${b}px;`));
  }
});

test('fadeMask never hides the pattern: every alpha is at least 0.5', () => {
  const alphas = Array.from(
    fadeMask(120)
      .join('\n')
      .matchAll(/\/ ([\d.]+)\)/g),
    (m) => Number(m[1]),
  );
  assert.ok(alphas.length >= 4);
  for (const a of alphas) assert.ok(a >= 0.5, `${a}`);
});
