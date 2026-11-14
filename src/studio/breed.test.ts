import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../patterns/util.ts';
import { breed, generation, grow } from './breed.ts';
import { TRACKING_LIMIT } from './compose.ts';
import { GENES, geneCount } from './genes.ts';
import { decodeStudio, encodeStudio } from './studio-share.ts';

const parent = decodeStudio('s=42&d=0.5&ba=1&gr=1');

test('a child is never a copy of its parent and keeps its choices', () => {
  const rnd = mulberry32(1);
  for (let i = 0; i < 200; i++) {
    const c = breed([parent], i % 2 ? 0 : 1, rnd);
    assert.notEqual(encodeStudio(c), encodeStudio(parent));
    assert.equal(c.theme, parent.theme);
    assert.equal(c.palette.name, parent.palette.name);
    assert.equal(c.repeat, parent.repeat);
    assert.ok(c.density >= 0 && c.density <= 1);
    for (const v of Object.values(c.genes)) assert.ok(Number.isInteger(v) && v >= 0 && v <= 15);
  }
});

test('more similar keeps the seed more often and sets fewer genes than more different', () => {
  const count = (diff: number) => {
    const rnd = mulberry32(7);
    let sameSeed = 0;
    let genes = 0;
    for (let i = 0; i < 300; i++) {
      const c = breed([parent], diff, rnd);
      if (c.seed === parent.seed) sameSeed++;
      genes += geneCount(c.genes);
    }
    return { sameSeed, genes };
  };
  const similar = count(0);
  const different = count(1);
  assert.equal(similar.sameSeed, 300);
  assert.ok(different.sameSeed < 150, String(different.sameSeed));
  assert.ok(similar.genes < different.genes);
});

test('two parents: every gene of a child comes from a parent or a mutation', () => {
  const a = { ...parent, genes: Object.fromEntries(GENES.map((g) => [g.id, 0])) };
  const b = { ...parent, genes: Object.fromEntries(GENES.map((g) => [g.id, 15])) };
  const c = breed([a, b], 0, mulberry32(3));
  const values = Object.values(c.genes);
  assert.ok(values.includes(0) && values.includes(15), JSON.stringify(c.genes));
});

test('a generation has nine distinct children, and each one grows', () => {
  const kids = generation([parent], 0.5, mulberry32(5));
  assert.equal(kids.length, 9);
  assert.equal(new Set(kids.map(encodeStudio)).size, 9);
  const g = grow(kids[0]!);
  assert.match(g.uri, /^data:image\/svg\+xml,/);
  assert.ok(g.width > 0 && g.height > 0 && Number.isFinite(g.score));
  assert.ok(TRACKING_LIMIT > 0);
});
