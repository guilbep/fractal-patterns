import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { APCA_SCORE, APCA_VERSION, apcaLc, apcaWorst, lcText, polarity } from './apca.ts';
import { parseHex, relativeLuminance, toHex } from './contrast.ts';
import { WCAG_SCORE, fixWithFill } from './pairing.ts';

// Reference vectors from the package's own test folder (node_modules/apca-w3/test/index.js).
test('matches the vectors of the apca-w3 test suite', () => {
  assert.equal(apcaLc('#888888', '#ffffff'), 63.056469930209424);
  assert.equal(apcaLc('#ffffff', '#888888'), -68.54146436644962);
  assert.equal(apcaLc('#000000', '#aaaaaa'), 58.146262578561334);
  assert.equal(apcaLc('#aaaaaa', '#000000'), -56.24113336839742);
  assert.equal(apcaLc('#112233', '#ddeeff'), 91.66830811481631);
  assert.equal(apcaLc('#ddeeff', '#112233'), -93.06770049484275);
});

// The package documents no value for black and white, only the range (about -108 to 106).
test('black on white is positive, white on black negative, both above 100', () => {
  const bow = apcaLc('#000000', '#ffffff');
  const wob = apcaLc('#ffffff', '#000000');
  assert.ok(bow > 100 && bow < 110, String(bow));
  assert.ok(wob < -100 && wob > -110, String(wob));
  assert.equal(lcText(bow), 'Lc 106');
  assert.equal(lcText(wob), 'Lc -108');
  assert.equal(polarity(bow), 'dark text on light');
  assert.equal(polarity(wob), 'light text on dark');
  assert.equal(polarity(0), 'no polarity');
});

// Seeded LCG: the same 20 pairs on every run.
function rng(seed: number): () => number {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const color = (r: () => number) => toHex([r() * 256, r() * 256, r() * 256]);

test('the wrapper returns exactly what the package returns', () => {
  const r = rng(42);
  for (let i = 0; i < 20; i++) {
    const [t, b] = [color(r), color(r)];
    assert.equal(apcaLc(t, b), APCAcontrast(sRGBtoY(parseHex(t)), sRGBtoY(parseHex(b))));
  }
});

test('apcaWorst is never above the background value in magnitude', () => {
  const r = rng(7);
  for (let i = 0; i < 20; i++) {
    const roles = { background: color(r), pattern: color(r), text: color(r), fill: r() < 0.5 ? color(r) : null, fillOpacity: r() };
    const o = r();
    const bare = Math.abs(apcaLc(roles.text, roles.background));
    for (const plate of [0, 0.5, 1]) assert.ok(Math.abs(apcaWorst(roles, o, plate)) <= bare);
    assert.equal(apcaWorst(roles, o, 1), apcaLc(roles.text, roles.background));
  }
});

test('the build defines the installed package version', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../node_modules/apca-w3/package.json', import.meta.url), 'utf8'));
  const { default: config } = await import('../vite.config.ts');
  assert.equal(config.define?.__APCA_VERSION__, JSON.stringify(pkg.version));
  assert.equal(APCA_VERSION, 'unknown'); // no define under node --test
});

// The fix search with the APCA score (pairing.ts fixWithFill, APCA_SCORE). Every expected Lc is measured with apcaLc.
const raise = (
  r: { background: string; pattern: string; text: string },
  opacity: number,
  target: number,
  mode: 'plate' | 'split' | 'direct' = 'direct',
) => fixWithFill(mode, r, opacity, 0, target, undefined, APCA_SCORE);

test('APCA fix raises dark text on light to Lc 75 and moves the text darker', () => {
  const r = { background: '#ffffff', pattern: '#dddddd', text: '#848484' };
  const start = apcaWorst(r, 0.5, 0);
  assert.ok(start > 45 && start < 65, `start Lc ${start}`);
  const f = raise(r, 0.5, 75);
  assert.equal(f.reached, true);
  const now = apcaWorst({ ...r, text: f.text }, f.opacity, 0);
  assert.ok(now >= 75, `now Lc ${now}`);
  assert.equal(f.ratio, Math.abs(now));
  assert.ok(relativeLuminance(f.text) < relativeLuminance(r.text), 'text moved darker');
});

test('APCA fix keeps light-on-dark polarity', () => {
  const r = { background: '#111111', pattern: '#333333', text: '#777777' };
  assert.ok(apcaWorst(r, 0.5, 0) < 0);
  const f = raise(r, 0.5, 75);
  assert.equal(f.reached, true);
  const now = apcaWorst({ ...r, text: f.text }, f.opacity, 0);
  assert.ok(now <= -75, `now Lc ${now}`);
  assert.ok(relativeLuminance(f.text) > relativeLuminance(r.text), 'text moved lighter');
});

test('APCA fix reports an unreachable target with the best value applied', () => {
  const r = { background: '#808080', pattern: '#888888', text: '#7a7a7a' };
  const f = raise(r, 0, 90);
  assert.equal(f.reached, false);
  const now = Math.abs(apcaWorst({ ...r, text: f.text }, f.opacity, 0));
  assert.equal(f.ratio, now);
  assert.ok(now < 90 && now > Math.abs(apcaWorst(r, 0, 0)), `best Lc ${now}`);
  // The best end for dark text on mid gray is black: nothing in the search beats it.
  assert.equal(now, Math.abs(apcaLc('#000000', r.background)));
});

test('APCA split fix aims the heading at the next lower level', () => {
  assert.equal(APCA_SCORE.lower(90), 75);
  assert.equal(APCA_SCORE.lower(75), 60);
  assert.equal(APCA_SCORE.lower(60), 45);
  const r = { background: '#ffffff', pattern: '#cccccc', text: '#9a9a9a' };
  const f = fixWithFill('split', r, 0.6, 0.5, 75, undefined, APCA_SCORE);
  assert.equal(f.reached, true);
  assert.ok(Math.abs(apcaWorst({ ...r, text: f.text }, f.opacity, f.plate)) >= 75);
  assert.ok(Math.abs(apcaWorst({ ...r, text: f.text }, f.opacity, 0)) >= 60);
});

test('the WCAG score passed explicitly gives the default result', () => {
  for (const mode of ['plate', 'split', 'direct'] as const) {
    const r = { background: '#f4efe6', pattern: '#5a7d9a', text: '#8a8a8a' };
    assert.deepEqual(fixWithFill(mode, r, 0.6, 0.3, 4.5, undefined, WCAG_SCORE), fixWithFill(mode, r, 0.6, 0.3, 4.5));
  }
});
