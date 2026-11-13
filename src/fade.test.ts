import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeMask, fadeMask, fadeSizes } from './fade.ts';
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

test('changeMask: one linear gradient from full strength to the faint end, clamped to 0.2..0.8', () => {
  assert.equal(changeMask('down', 0.4), 'linear-gradient(to bottom, rgb(0 0 0 / 1), rgb(0 0 0 / 0.4))');
  assert.equal(changeMask('up', 0.4), 'linear-gradient(to top, rgb(0 0 0 / 1), rgb(0 0 0 / 0.4))');
  assert.equal(changeMask('across', 0.6), 'linear-gradient(to right, rgb(0 0 0 / 1), rgb(0 0 0 / 0.6))');
  assert.ok(changeMask('down', 0).endsWith('/ 0.2))'));
  assert.ok(changeMask('down', 1).endsWith('/ 0.8))'));
});

test('fadeMask with a change gradient: a third layer, sized to the element, intersected', () => {
  const g = changeMask('down', 0.4);
  const [a, b] = fadeSizes(120);
  const l = fadeMask(120, g);
  assert.ok(l.includes(`mask-size: ${a}px ${a}px, ${b}px ${b}px, 100% 100%;`));
  assert.ok(l.some((x) => x.startsWith('mask-image: radial-gradient(') && x.endsWith(`, ${g};`)));
  assert.ok(l.includes('mask-composite: intersect;'));
});
