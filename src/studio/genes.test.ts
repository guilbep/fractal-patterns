import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compose, themeFamilies, type Theme, type ThemeFamily } from './compose.ts';
import { decodeGenes, encodeGenes, GENES, NO_GENES, type GeneId, type Genes } from './genes.ts';
import { studioSvg } from './model.ts';
import { decodeStudio, designOptions, type StudioDesign } from './studio-share.ts';

const hash = (d: StudioDesign) =>
  createHash('sha256')
    .update(studioSvg(compose(designOptions(d))))
    .digest('hex')
    .slice(0, 16);

// Hashes of the Studio SVG made by the code before genes (branch phase10, 2fa78d5) for these saved links.
// A link without g must keep opening the same wallpaper.
const BEFORE_GENES: readonly [string, string][] = [
  ['ba=1&gr=1', 'b51e6ea1b4e300c3'],
  ['s=7&ba=1&gr=1', 'd28bf1dfd8cf9c85'],
  ['s=123456&r=1&d=0.7&ba=1&gr=0', 'a15a522383bf0c5b'],
  ['s=99&r=2&t=s&ba=1&gr=1', 'a8753d339157ee53'],
  ['s=4242&r=3&t=o&d=0.2&ba=0&gr=1', 'ab34fbaa776c5b10'],
  ['s=31337&t=o&f=5&ba=1&gr=1', '23578a4efb205bdb'],
  ['s=5&lg=1&ba=1&gr=1', '3eb8058bd9b58235'],
  ['s=2024&d=0.9&st=0&ba=1&gr=1', '88120d995e1b982c'],
  ['s=77&pn=Lagoon&r=1&t=s&f=12&ba=1&gr=0', '78f032fdda25f811'],
  ['s=8&d=0.55&z=420&ba=0&gr=0', 'b592392b13387cb2'],
  ['s=4000000000&r=3&ba=1&gr=1', 'be2d16b27af8c563'],
  ['s=12&t=s&d=0.1&lg=1&ba=1&gr=1', '002110950ae155d0'],
  ['p=9&s=3', '71ef314e3669a3fa'],
  ['s=650&r=2&t=o&d=0.8&ba=1&gr=1', '038f0dbe527a51fd'],
];

test('old links (no g) open the same wallpaper as before genes', () => {
  for (const [link, h] of BEFORE_GENES) assert.equal(hash(decodeStudio(link)), h, link);
});

test('genes survive a round trip; no genes encode to nothing', () => {
  assert.equal(encodeGenes(NO_GENES), '');
  const all: Genes = Object.fromEntries(GENES.map((x, i) => [x.id, i % 16]));
  assert.deepEqual(decodeGenes(encodeGenes(all)), all);
  assert.ok(encodeGenes(all).length <= 17, encodeGenes(all));
  const one: Genes = { petals: 15 };
  assert.deepEqual(decodeGenes(encodeGenes(one)), one);
  assert.ok(encodeGenes(one).length <= 4);
});

test('a malformed g gives no genes and never throws', () => {
  for (const bad of [null, '', '!!', 'A', '////', 'é', '_'.repeat(3)]) assert.doesNotThrow(() => decodeGenes(bad));
  assert.deepEqual(decodeGenes('!!'), NO_GENES);
  assert.deepEqual(decodeGenes('A'), NO_GENES); // shorter than the mask
});

test('every gene changes the wallpaper of a design that draws its motif', () => {
  // The gene's theme and the one family it shapes (none: a plant gene, every family).
  const FAMILY: Partial<Record<GeneId, [Theme, ThemeFamily]>> = {
    leafWidth: ['floral', 'leaf'],
    leafBend: ['floral', 'leaf'],
    leafVeins: ['floral', 'leaf'],
    frondPairs: ['floral', 'frond'],
    frondSpread: ['floral', 'frond'],
    petals: ['floral', 'flower'],
    petalWidth: ['floral', 'flower'],
    budOpen: ['floral', 'bud'],
    berries: ['floral', 'berry'],
    sprigLeaves: ['floral', 'sprig'],
    sprigFan: ['floral', 'sprig'],
    kelpWave: ['sea', 'kelp'],
    coralSpread: ['sea', 'coral'],
    fruitWidth: ['orchard', 'pear'],
    appleDip: ['orchard', 'apple'],
  };
  for (const { id } of GENES) {
    const [theme, family] = FAMILY[id] ?? ['floral', null];
    const base: StudioDesign = {
      ...decodeStudio('s=11&d=0.6&ba=0&gr=0'),
      theme,
      families: family ? [family] : themeFamilies(theme).map((f) => f.id),
    };
    const lo = hash({ ...base, genes: { [id]: 0 } });
    const hi = hash({ ...base, genes: { [id]: 15 } });
    assert.notEqual(lo, hi, id);
  }
});
