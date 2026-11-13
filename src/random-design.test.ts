import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS } from './fractal.ts';
import { LAYOUT_EXAMPLES, randomLayout, randomRepetition } from './random-design.ts';
import { optionsFor } from './repetition.ts';
import { canVary } from './supertile.ts';
import { STRENGTHS, VARIANT_DEFAULTS } from './variants.ts';

// mulberry32: a small seeded generator for repeatable draws.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const inRange = (v: number, lo: number, hi: number) => assert.ok(v >= lo && v <= hi, `${v} not in ${lo}..${hi}`);

test('randomRepetition: a kind that cannot vary gets variants off', () => {
  const fixed = KINDS.filter((k) => !canVary(k));
  assert.ok(fixed.length > 0);
  for (const k of fixed) for (let i = 0; i < 20; i++) assert.equal(randomRepetition(k, seeded(i)).variants, false);
});

test('randomRepetition: 200 draws per kind stay in range and never set forbidden options', () => {
  const strengths = STRENGTHS.slice(0, 3);
  let on = 0;
  let l2 = 0;
  for (const k of KINDS) {
    const ok = optionsFor(k);
    const rnd = seeded(KINDS.indexOf(k) + 1);
    for (let i = 0; i < 200; i++) {
      const r = randomRepetition(k, rnd);
      const o = r.variantOptions;
      if (r.variants) on++;
      if (!r.variants) assert.deepEqual(o, VARIANT_DEFAULTS);
      assert.ok(strengths.some((s) => s.cells === o.cells && s.count === o.count));
      assert.equal(o.skip, 0);
      assert.equal(o.depths, false);
      assert.ok(['none', 'half-drop', 'brick'].includes(o.drop));
      assert.ok(o.jitter === 0 || (o.jitter >= 0.2 && o.jitter <= 0.6));
      assert.ok(o.weights === 0 || (o.weights >= 0.2 && o.weights <= 0.5));
      if (!ok.orient) assert.equal(o.orient, false);
      if (!ok.drop) assert.equal(o.drop, 'none');
      if (!ok.jitter) assert.equal(o.jitter, 0);
      if (!ok.weights) assert.equal(o.weights, 0);
      assert.equal(r.layer2, r.layer2Settings !== null);
      if (r.layer2Settings) {
        l2++;
        const { scale, rotate, opacity } = r.layer2Settings;
        assert.ok((scale >= 0.6 && scale < 0.9) || (scale > 1.1 && scale <= 1.8), `scale ${scale}`);
        assert.ok([0, 30, 45, 90].includes(rotate));
        inRange(opacity, 0.4, 0.8);
      }
    }
  }
  assert.ok(on > 0 && l2 > 0);
});

// The slider ranges of MotionPanel.vue.
const checkMotion = (m: { rotate: number; scale: number; skew: number; tilt: number }) => {
  inRange(m.rotate, -180, 180);
  inRange(m.scale, 0.5, 3);
  inRange(m.skew, -45, 45);
  inRange(m.tilt, 0, 70);
};

test('LAYOUT_EXAMPLES stay inside the slider ranges', () => {
  assert.deepEqual(
    LAYOUT_EXAMPLES.map((e) => e.label),
    ['Plain', 'Diagonal', 'Tilted floor', 'Slow drift'],
  );
  for (const e of LAYOUT_EXAMPLES) {
    checkMotion(e.motion);
    inRange(e.motion.speed, 2, 30);
  }
});

test('randomLayout: 200 draws in range, never drift', () => {
  const rnd = seeded(7);
  for (let i = 0; i < 200; i++) {
    const m = randomLayout(rnd);
    checkMotion(m);
    inRange(m.rotate, -45, 45);
    assert.equal(Math.abs(m.rotate % 5), 0);
    inRange(m.scale, 0.8, 1.6);
    assert.ok(m.skew === 0 || (m.skew >= -15 && m.skew <= 15));
    assert.ok(m.tilt === 0 || (m.tilt >= 20 && m.tilt <= 55));
    assert.ok(!('drift' in m) && !('speed' in m));
  }
});
