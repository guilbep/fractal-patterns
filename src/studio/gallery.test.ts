import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mulberry32 } from '../patterns/util.ts';
import { cellOf, mapElites, MOODS } from './gallery.ts';
import { decodeStudio } from './studio-share.ts';

test('MAP-Elites keeps one design per cell, and each link opens a design of that cell', () => {
  const elites = mapElites({ rnd: mulberry32(1), initial: 8, iterations: 8 });
  assert.ok(elites.length > 1);
  const keys = elites.map((e) => JSON.stringify(e.cell));
  assert.equal(new Set(keys).size, keys.length);
  for (const e of elites) {
    assert.deepEqual(cellOf(decodeStudio(e.link)), e.cell);
    assert.ok(Number.isFinite(e.score));
    assert.match(e.svg, /^<svg/);
  }
});

test('the committed gallery links decode to their cells', () => {
  const { cells } = JSON.parse(readFileSync(new URL('../../public/gallery/studio.json', import.meta.url), 'utf8'));
  assert.ok(cells.length >= 48, String(cells.length));
  for (const c of cells) {
    assert.ok(MOODS.includes(c.mood));
    assert.deepEqual(cellOf(decodeStudio(c.link.replace(/^studio\.html/, ''))), { density: c.density, curl: c.curl, mood: c.mood });
  }
});
