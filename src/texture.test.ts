import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTES,
  TEXTURE_DEFAULTS,
  TEXTURE_KINDS,
  clampTexture,
  decodeTexture,
  encodeTexture,
  fromGrain,
  toneApplies,
  type Texture,
} from './texture.ts';
import { decodeDesign } from './share.ts';

test('te: round trip for every kind, route, strength, scale, seed and tone', () => {
  let n = 0;
  for (const kind of TEXTURE_KINDS.filter((k) => k !== 'grain'))
    for (const route of ROUTES[kind])
      for (const strength of [0, 55, 100])
        for (const scale of [0.5, 1.25, 2])
          for (const seed of [0, 9999])
            for (const tone of ['dark', 'light'] as const) {
              const t: Texture = { on: true, kind, route, strength, scale, seed, tone };
              assert.deepEqual(decodeTexture(encodeTexture(t)), clampTexture(t));
              n++;
            }
  assert.ok(n > 0);
});

test('te: paper defaults encode as paper.40.4.1.d.b (scale in quarter steps)', () => {
  assert.equal(encodeTexture({ ...TEXTURE_DEFAULTS, on: true, kind: 'paper', route: 'baked' }), 'paper.40.4.1.d.b');
  assert.equal(encodeTexture({ ...TEXTURE_DEFAULTS, on: true, kind: 'sand', scale: 1.25 }), 'sand.40.5.1.d.l');
});

test('te: grain and off never encode; a grain te string decodes to null', () => {
  assert.equal(encodeTexture({ ...TEXTURE_DEFAULTS, on: true }), null);
  assert.equal(encodeTexture({ ...TEXTURE_DEFAULTS, kind: 'paper', route: 'baked' }), null);
  assert.equal(decodeTexture('grain.40.1.1.d.l'), null);
});

test('te: malformed gives null; out of range is clamped', () => {
  for (const s of [null, '', 'x', 'paper', 'paper.a.b.c.d.e', 'nope.40.1.1.d.b', 'paper.40.1.2.5.1.d.b'])
    assert.equal(decodeTexture(s), null);
  assert.deepEqual(decodeTexture('paper.400.9.-3.d.v'), {
    on: true,
    kind: 'paper',
    strength: 100,
    scale: 2,
    seed: 0,
    tone: 'dark',
    route: 'baked',
  });
});

test('toneApplies: palette kinds ignore the tone', () => {
  const toned = TEXTURE_KINDS.filter(toneApplies);
  assert.deepEqual(toned, ['grain', 'paper', 'coldpress', 'linen', 'plaster', 'sand', 'riso']);
});

test('fromGrain: off is null, on maps to a live grain texture, the grain is untouched', () => {
  assert.equal(fromGrain({ on: false, amount: 12, size: 0.75, tone: 'dark' }), null);
  const g = { on: true, amount: 12, size: 0.75, tone: 'light' } as const;
  const before = structuredClone(g);
  const t = fromGrain(g);
  assert.equal(t?.kind, 'grain');
  assert.equal(t?.tone, 'light');
  assert.equal(t?.route, 'live');
  assert.equal(t?.on, true);
  assert.deepEqual(g, before);
});

test('gr: old grain links still decode the same', () => {
  assert.deepEqual(decodeDesign('gr=12_0.75_d').grain, { on: true, amount: 12, size: 0.75, tone: 'dark' });
});
