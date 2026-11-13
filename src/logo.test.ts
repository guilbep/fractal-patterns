import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOGO_DEFAULT, MARK_COLORS, builderLogoSvg, logoSvg, studioLogoSvg, truchetLogoSvg } from './logo.ts';

test('logoSvg draws the default mark as one compact, deterministic line', () => {
  const s = logoSvg(LOGO_DEFAULT);
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(s.includes('viewBox="0 0 64 64"'));
  assert.equal(s.match(/<rect/g)?.length, 1);
  assert.ok(s.includes('rx="12"'));
  assert.ok(s.indexOf('<rect') < s.indexOf('<path'));
  assert.ok(s.includes(LOGO_DEFAULT.background) && s.includes(LOGO_DEFAULT.color));
  assert.ok(!s.includes('\n'));
  assert.equal(s, logoSvg(LOGO_DEFAULT));
  assert.ok(s.length < 3000, `${s.length} chars`);
});

test('logoSvg changes with the seed and the kind', () => {
  const s = logoSvg(LOGO_DEFAULT);
  assert.notEqual(logoSvg({ ...LOGO_DEFAULT, seed: LOGO_DEFAULT.seed + 1 }), s);
  assert.notEqual(logoSvg({ ...LOGO_DEFAULT, kind: 'hilbert' }), s);
});

test('studioLogoSvg draws a small, deterministic botanical mark in the logo style', () => {
  const s = studioLogoSvg();
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(s.includes('viewBox="0 0 64 64"') && s.includes('rx="12"'));
  assert.equal(s.match(/<ellipse/g)?.length, 5);
  assert.ok(s.includes(LOGO_DEFAULT.background) && s.includes(LOGO_DEFAULT.color));
  assert.ok(!s.includes('\n'));
  assert.equal(s, studioLogoSvg());
  assert.notEqual(s, logoSvg(LOGO_DEFAULT));
  assert.ok(s.length < 700, `${s.length} chars`);
});

test('truchetLogoSvg draws the Truchet tile as one compact, deterministic line', () => {
  const s = truchetLogoSvg();
  assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  for (const part of [
    'viewBox="0 0 24 24"',
    'rx="5"',
    'M12 0A12 12 0 0 1 0 12M24 12A12 12 0 0 0 12 24',
    'stroke-width="2.6"',
    '#17181C',
    '#F3F2EC',
    'width="64"',
  ])
    assert.ok(s.includes(part), part);
  assert.ok(truchetLogoSvg({ size: 28 }).includes('width="28" height="28"'));
  assert.equal(s, truchetLogoSvg());
  assert.ok(s.length < 400, `${s.length} chars`);
});

// The header shows these files, so they must not drift from the functions: run `npm run logo` after a change to the marks.
test('each committed public/favicon*.svg equals the output of its function plus a newline', () => {
  const files: [string, string][] = [
    ['favicon.svg', truchetLogoSvg()],
    ['favicon-studio.svg', studioLogoSvg(MARK_COLORS)],
    ['favicon-builder.svg', builderLogoSvg(MARK_COLORS)],
  ];
  for (const [name, svg] of files) assert.equal(readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'), svg + '\n', name);
});
