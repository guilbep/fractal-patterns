import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blend, contrastRatio, parseHex, toHex } from './contrast.ts';
import { patternContrast, worstTextContrast, type Roles } from './pairing.ts';
import { mulberry32 } from './patterns/util.ts';
import { layerSpots } from './layers.ts';
import {
  CVD_LABELS,
  CVD_MATRICES,
  CVD_TYPES,
  betweenSurfaces,
  cvdReport,
  cvdWorstText,
  effectiveOpacity,
  lightnessDiff,
  lstar,
  simulate,
  simulateRoles,
} from './vision.ts';

const dist = (a: string, b: string): number => {
  const [x, y] = [parseHex(a), parseHex(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

test('betweenSurfaces', () => {
  const r: Roles = { background: '#ffffff', pattern: '#000000', text: '#767676' };
  assert.equal(betweenSurfaces(r, 1), true);
  assert.equal(betweenSurfaces({ ...r, text: '#000000' }, 1), false);
  assert.equal(betweenSurfaces({ ...r, text: '#ffffff' }, 1), false);
  assert.equal(betweenSurfaces(r, 0), false);
  assert.equal(betweenSurfaces({ background: '#12232e', pattern: '#4da8da', text: '#eefbfb' }, 0.6), false);
  assert.equal(betweenSurfaces({ background: '#ffffff', pattern: '#fefefe', text: '#fefeff' }, 1), false);
});

test('labels', () => {
  assert.deepEqual(CVD_LABELS, { protan: 'Red-weak (protan)', deutan: 'Green-weak (deutan)', tritan: 'Blue-weak (tritan)' });
});

test('each matrix row sums to 1', () => {
  let rows = 0;
  for (const t of CVD_TYPES) {
    for (const row of CVD_MATRICES[t]) {
      assert.ok(Math.abs(row[0] + row[1] + row[2] - 1) <= 2e-6, `${t} ${row.join(',')}`);
      rows++;
    }
  }
  assert.equal(rows, 9);
});

test('simulate keeps grays', () => {
  for (const g of ['#000000', '#404040', '#808080', '#c0c0c0', '#ffffff']) {
    for (const t of CVD_TYPES) {
      const out = parseHex(simulate(g, t));
      const inp = parseHex(g);
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(out[i]! - inp[i]!) <= 1, `${g} ${t} -> ${toHex(out)}`);
    }
  }
});

test('simulate returns lower-case #rrggbb for random colors', () => {
  const rnd = mulberry32(42);
  for (let i = 0; i < 20; i++) {
    const hex = toHex([rnd() * 255, rnd() * 255, rnd() * 255]);
    for (const t of CVD_TYPES) assert.match(simulate(hex, t), /^#[0-9a-f]{6}$/, `${hex} ${t}`);
  }
});

test('red and green come closer for deutan and protan', () => {
  for (const t of ['deutan', 'protan'] as const) {
    assert.ok(dist(simulate('#ff0000', t), simulate('#00a000', t)) < dist('#ff0000', '#00a000') / 2, t);
  }
});

test('tritan brings blue and green closer', () => {
  assert.ok(dist(simulate('#0000ff', 'tritan'), simulate('#00a000', 'tritan')) < dist('#0000ff', '#00a000'));
});

test('deutan red near the hand-computed estimate #a39000', () => {
  const [r, g, b] = parseHex(simulate('#ff0000', 'deutan'));
  const want = [163, 144, 0];
  for (const [i, v] of [r, g, b].entries()) assert.ok(Math.abs(v - want[i]!) <= 2, simulate('#ff0000', 'deutan'));
});

test('simulateRoles applies simulate to each color', () => {
  const r: Roles = { background: '#12232e', pattern: '#4da8da', text: '#ff0000' };
  for (const t of CVD_TYPES) {
    assert.deepEqual(simulateRoles(r, t), {
      background: simulate(r.background, t),
      pattern: simulate(r.pattern, t),
      text: simulate(r.text, t),
    });
  }
});

test('cvdReport and cvdWorstText', () => {
  const r: Roles = { background: '#ffffff', pattern: '#808080', text: '#000000' };
  const rep = cvdReport(r, 0.6);
  assert.deepEqual(
    rep.map((c) => c.type),
    [...CVD_TYPES],
  );
  for (const c of rep) {
    assert.deepEqual(c.roles, simulateRoles(r, c.type));
    assert.ok(Math.abs(c.text - worstTextContrast(r, 0.6)) <= 0.2, `${c.type} text ${c.text}`);
    assert.ok(Math.abs(c.pattern - patternContrast(r, 0.6)) <= 0.2, `${c.type} pattern ${c.pattern}`);
  }
  assert.equal(cvdWorstText(r, 0.6), Math.min(...rep.map((c) => c.text)));
});

test('cvdReport with a fill', () => {
  const r: Roles = { background: '#ffffff', pattern: '#808080', text: '#000000' };
  // Absent or null fill: same results as before.
  assert.deepEqual(
    cvdReport(r, 0.6, null),
    cvdReport(r, 0.6).map((c) => ({ ...c, fill: null })),
  );
  assert.equal(cvdWorstText(r, 0.6, null), cvdWorstText(r, 0.6));
  // A dark fill under black text: worse than the background and the strokes.
  const fill = { color: '#404040', opacity: 0.8 };
  const rep = cvdReport(r, 0.6, fill);
  for (const c of rep) {
    const surface = blend(simulate(fill.color, c.type), c.roles.background, fill.opacity);
    const onFill = Math.min(contrastRatio(c.roles.text, surface), contrastRatio(c.roles.text, blend(c.roles.pattern, surface, 0.6)));
    assert.ok(onFill < worstTextContrast(c.roles, 0.6));
    assert.equal(c.text, onFill);
    assert.equal(c.fill, simulate(fill.color, c.type));
  }
  assert.equal(cvdWorstText(r, 0.6, fill), Math.min(...rep.map((c) => c.text)));
  assert.ok(cvdWorstText(r, 0.6, fill) < cvdWorstText(r, 0.6));
  // betweenSurfaces sees text between the fill and the strokes over it.
  const mid: Roles = { background: '#000000', pattern: '#000000', text: '#808080' };
  assert.equal(betweenSurfaces({ ...mid, pattern: '#000000' }, 1), false);
  assert.equal(betweenSurfaces(mid, 1, { color: '#ffffff', opacity: 1 }), true);
});

test('lstar', () => {
  assert.ok(Math.abs(lstar('#ffffff') - 100) <= 1e-6);
  assert.ok(Math.abs(lstar('#000000')) <= 1e-6);
  const grays = ['#000000', '#333333', '#777777', '#bbbbbb', '#ffffff'].map(lstar);
  for (let i = 1; i < grays.length; i++) assert.ok(grays[i]! > grays[i - 1]!, `${grays[i]} > ${grays[i - 1]}`);
  assert.ok(Math.abs(lstar('#777777') - 50) <= 0.5, `${lstar('#777777')}`);
});

test('lightnessDiff', () => {
  const a = lightnessDiff('#000000', '#ffffff');
  assert.ok(Math.abs(a.value - 100) <= 1e-6);
  assert.equal(a.polarity, 'dark-on-light');
  const b = lightnessDiff('#ffffff', '#000000');
  assert.ok(Math.abs(b.value - 100) <= 1e-6);
  assert.equal(b.polarity, 'light-on-dark');
  assert.deepEqual(lightnessDiff('#777777', '#777777'), { value: 0, polarity: 'same' });
});

test('effectiveOpacity', () => {
  assert.ok(Math.abs(effectiveOpacity(0.6, 0.85) - 0.09) <= 1e-9);
  assert.equal(effectiveOpacity(0.6, 0), 0.6);
  assert.equal(effectiveOpacity(0.6, 2), 0);
});

test('source hygiene', () => {
  const src = readFileSync(join(import.meta.dirname, 'vision.ts'), 'utf8');
  assert.doesNotMatch(src, /node:/i);
  assert.doesNotMatch(src, /document/i);
  assert.doesNotMatch(src, /apca/i);
});

test('cvdReport counts the crossings of two layers and an own second color, like the main check', () => {
  const r: Roles = { background: '#ffffff', pattern: '#888888', text: '#333333' };
  const o = 0.6;
  const p = 0.5;
  const two = (x: number) => layerSpots(x, 2, p);
  for (const type of ['protan', 'deutan', 'tritan'] as const) {
    const s = { background: simulate(r.background, type), pattern: simulate(r.pattern, type), text: simulate(r.text, type) };
    // Same color: the crossing carries the strokes at the highest spot, darker than one stroke.
    const crossing = blend(s.pattern, s.background, Math.max(...two(o)));
    const one = cvdReport(r, o).find((c) => c.type === type)!.text;
    const withTwo = cvdReport(r, o, null, 0, two).find((c) => c.type === type)!.text;
    assert.ok(Math.abs(withTwo - contrastRatio(s.text, crossing)) < 1e-9);
    assert.ok(withTwo < one);
    // Own second color close to the text: the worst surface is that color over the first stroke.
    const color = '#3a3a3a';
    const sc = simulate(color, type);
    const rep = cvdReport({ ...r, second: { color, strength: p } }, o).find((c) => c.type === type)!;
    assert.equal(rep.second, sc);
    const expected = contrastRatio(s.text, blend(sc, blend(s.pattern, s.background, o), o * p));
    assert.ok(Math.abs(rep.text - expected) < 1e-9);
    assert.ok(rep.text < one);
  }
});
