import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { APCA_VERSION, apcaLc, apcaWorst, lcText, polarity } from './apca.ts';
import { parseHex, toHex } from './contrast.ts';

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
