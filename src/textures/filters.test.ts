import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { liveTextureSvg, type LiveKind, type LiveOptions } from './filters.ts';
import { GRAIN_DEFAULTS, grainSvg } from '../grain.ts';

const KINDS: LiveKind[] = ['paper', 'coldpress', 'linen', 'plaster', 'sand', 'riso'];
const DEF: LiveOptions = { seed: 1, scale: 1, strength: 40, tone: 'dark' };
const VARIANTS: LiveOptions[] = [
  DEF,
  { seed: 7, scale: 0.5, strength: 100, tone: 'light' },
  { seed: 3, scale: 2, strength: 0, tone: 'dark' },
  { seed: 2, scale: 1.3, strength: 65, tone: 'light', tile: 199 },
];
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const opacity = (s: string): number => Number(/<rect [^>]*opacity="([^"]+)"/.exec(s)![1]);

test('well-formed', () => {
  for (const k of KINDS)
    for (const o of VARIANTS) {
      const s = liveTextureSvg(k, o);
      assert.equal(count(s, /<svg/g), 1, k);
      assert.equal(count(s, /<filter/g), 1, k);
      assert.match(s, /<filter id="t" x="0" y="0" width="100%" height="100%"/);
      // Every open tag is self-closed or closed, in order.
      const stack: string[] = [];
      for (const [, close, name, self] of s.matchAll(/<(\/?)([A-Za-z]+)[^>]*?(\/?)>/g)) {
        if (close) assert.equal(stack.pop(), name, k);
        else if (!self) stack.push(name!);
      }
      assert.deepEqual(stack, [], k);
      const turbs = s.match(/<feTurbulence[^>]*>/g)!;
      assert.ok(turbs.length > 0);
      for (const t of turbs) assert.match(t, /stitchTiles="stitch"/, k);
    }
});

test('every baseFrequency wraps on the tile', () => {
  for (const k of KINDS)
    for (const o of VARIANTS) {
      const t = o.tile ?? 257;
      for (const [, v] of liveTextureSvg(k, o).matchAll(/baseFrequency="([^"]+)"/g))
        for (const x of v!.split(' ').map(Number)) {
          assert.ok(x > 0, `${k} ${x}`);
          assert.ok(Math.abs(x * t - Math.round(x * t)) < 1e-9, `${k} ${x} * ${t}`);
        }
    }
});

test('strength maps to opacity, capped at 0.35', () => {
  for (const k of KINDS) {
    assert.equal(opacity(liveTextureSvg(k, { ...DEF, strength: 0 })), 0, k);
    for (const strength of [1, 40, 100, 500]) {
      const a = opacity(liveTextureSvg(k, { ...DEF, strength }));
      assert.ok(a > 0 && a <= 0.35, `${k} ${strength} ${a}`);
    }
  }
});

test('deterministic, and the seed reaches the noise', () => {
  for (const k of KINDS) {
    assert.equal(liveTextureSvg(k, DEF), liveTextureSvg(k, DEF));
    const other = liveTextureSvg(k, { ...DEF, seed: 9 });
    assert.match(other, /seed="9"/, k);
    assert.notEqual(other, liveTextureSvg(k, DEF));
  }
});

test('size per kind at defaults', () => {
  for (const k of KINDS) {
    const s = liveTextureSvg(k, DEF);
    const gz = gzipSync(s, { level: 9 }).length;
    console.log(`${k}: ${s.length} chars, ${gz} B gzip`);
    assert.ok(s.length < 1200, `${k} ${s.length}`);
  }
});

test('grain is untouched', () => {
  const s = grainSvg(GRAIN_DEFAULTS);
  assert.equal(s.length, 393);
  assert.equal(createHash('sha256').update(s).digest('hex').slice(0, 16), '18c8d35707fff7af');
});
