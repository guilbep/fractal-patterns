import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DESTINATIONS, clampCustom, detectedSize, pngFileName, resolvePreset } from './use-it.ts';

const byId = (id: string) => {
  const d = DESTINATIONS.find((x) => x.id === id);
  assert.ok(d, id);
  return d;
};

test('eight destinations in table order, unique labels, short how-to lines', () => {
  assert.deepEqual(
    DESTINATIONS.map((d) => d.id),
    ['phone', 'desktop', 'web', 'call', 'fabric', 'paper', 'game', 'slides'],
  );
  assert.equal(new Set(DESTINATIONS.map((d) => d.label)).size, 8);
  for (const d of DESTINATIONS) {
    // 30, not 25: the owner's mockup copy for the phone line has 27 words.
    const words = d.howTo.trim().split(/\s+/).filter(Boolean).length;
    assert.ok(words > 0 && words <= 30, `${d.id}: ${words} words`);
  }
});

test('preset sizes', () => {
  for (const d of DESTINATIONS) {
    for (const p of d.presets) {
      for (const n of [p.width, p.height]) {
        if (n !== undefined) assert.ok(Number.isInteger(n) && n > 0, `${d.id}/${p.id}`);
      }
    }
  }
  for (const p of byId('game').presets) {
    for (const n of [p.width!, p.height!]) assert.ok((n & (n - 1)) === 0, `${p.id}`);
  }
  assert.deepEqual(
    byId('game').presets.map((p) => p.width),
    [512, 1024, 2048],
  );
  const phone = byId('phone').presets;
  assert.equal(phone.filter((p) => p.detect === 'phone').length, 1);
  assert.equal(phone.filter((p) => p.custom).length, 1);
  assert.equal(byId('desktop').presets.filter((p) => p.detect === 'screen').length, 1);
  assert.equal(byId('phone').clockOption, true);
});

test('web is CSS with no pixel size; A3 is 3508×4961', () => {
  for (const p of byId('web').presets) {
    assert.equal(p.output, 'css');
    assert.equal(p.width, undefined);
  }
  const a3 = byId('paper').presets.find((p) => p.id === 'a3');
  assert.deepEqual([a3?.width, a3?.height], [3508, 4961]);
});

test('detectedSize', () => {
  assert.deepEqual(detectedSize(402, 874, 3, 'phone'), { width: 1206, height: 2622 });
  assert.deepEqual(detectedSize(874, 402, 3, 'phone'), { width: 1206, height: 2622 });
  assert.deepEqual(detectedSize(1512, 982, 2, 'screen'), { width: 3024, height: 1964 });
  assert.deepEqual(detectedSize(982, 1512, 2, 'screen'), { width: 3024, height: 1964 });
  assert.deepEqual(detectedSize(375, 812, 2.5, 'phone'), { width: 938, height: 2030 });
});

test('pngFileName', () => {
  assert.equal(pngFileName('fractal-tree-7', 1206, 2622), 'fractal-tree-7-1206x2622.png');
  assert.equal(pngFileName('pattern-builder', 512, 512), 'pattern-builder-512x512.png');
});

test('clampCustom', () => {
  assert.deepEqual(clampCustom(10, 9000), { width: 16, height: 8192 });
  assert.deepEqual(clampCustom(1000.4, 1000.6), { width: 1000, height: 1001 });
});

test('source hygiene', () => {
  const src = readFileSync(new URL('./use-it.ts', import.meta.url), 'utf8');
  for (const word of ['Math.random', 'Date', 'document', 'window']) {
    assert.ok(!src.includes(word), word);
  }
});

test('resolvePreset', () => {
  const s = { width: 1, height: 1, dpr: 1 };
  const c = { width: 1000, height: 1000 };
  assert.deepEqual(resolvePreset(byId('phone'), 'iphone-17', s, c), { width: 1206, height: 2622, output: 'png' });
  assert.deepEqual(resolvePreset(byId('phone'), 'this-phone', { width: 402, height: 874, dpr: 3 }, c), {
    width: 1206,
    height: 2622,
    output: 'png',
  });
  assert.deepEqual(resolvePreset(byId('desktop'), 'this-screen', { width: 1512, height: 982, dpr: 2 }, c), {
    width: 3024,
    height: 1964,
    output: 'png',
  });
  assert.deepEqual(resolvePreset(byId('phone'), 'custom', s, { width: 10, height: 99999 }), { width: 16, height: 8192, output: 'png' });
  assert.deepEqual(resolvePreset(byId('web'), 'repeat', s, c), { width: null, height: null, output: 'css' });
  assert.equal(resolvePreset(byId('paper'), 'svg', s, c).output, 'svg');
  assert.deepEqual(resolvePreset(byId('slides'), 'nope', s, c), resolvePreset(byId('slides'), '16-9', s, c));
  assert.deepEqual(resolvePreset(byId('slides'), 'nope', s, c), { width: 1920, height: 1080, output: 'png' });
});

test('every destination has a short hint for its card', () => {
  for (const d of DESTINATIONS) assert.ok(d.hint.trim().length > 0 && d.hint.length <= 30, d.id);
});
