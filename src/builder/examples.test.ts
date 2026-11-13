import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from './examples.ts';
import { designSvg, parseDesign } from './design.ts';
import { BASIC_STAMPS } from './stamps.ts';
import type { Design } from './types.ts';

const BACKGROUNDS: Record<string, string> = {
  beads: '#2e2e2e',
  drops: '#f8f6f3',
  squiggles: '#fde4ea',
  scales: '#dfe5df',
  leaves: '#cfd4d2',
};

const get = (id: string): Design => EXAMPLES.find((e) => e.id === id)!.make();
const stampNames = (d: Design): Set<string> => new Set(d.items.map((it) => d.stamps[it.stamp]!.name));

test('five examples with the expected ids and unique labels', () => {
  assert.deepEqual(
    EXAMPLES.map((e) => e.id),
    ['beads', 'drops', 'squiggles', 'scales', 'leaves'],
  );
  assert.equal(new Set(EXAMPLES.map((e) => e.label)).size, 5);
});

for (const e of EXAMPLES) {
  test(`${e.id}: deterministic, loads again, valid and seamless`, () => {
    const d = e.make();
    assert.deepEqual(e.make(), d);
    assert.deepEqual(parseDesign(JSON.parse(JSON.stringify(d))), d);
    assert.ok(d.items.length >= 6 && d.items.length <= 200, `${d.items.length} items`);
    const keys = new Set<string>();
    for (const it of d.items) {
      assert.ok(d.stamps[it.stamp] !== undefined);
      assert.ok(it.x >= 0 && it.x < d.width && it.y >= 0 && it.y < d.height, `${it.x},${it.y}`);
      keys.add([it.stamp, it.x, it.y, it.rotate, it.scale, it.flip].join('|'));
    }
    assert.equal(keys.size, d.items.length, 'no doubled item');
    assert.equal(d.background?.toLowerCase(), BACKGROUNDS[e.id]);
    const svg = designSvg(d);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.length < 40000, `${svg.length} characters`);
  });
}

test('each example uses the stamps of its picture', () => {
  assert.ok(get('beads').items.every((it) => it.rotate === 0));
  const leaves = get('leaves');
  assert.ok(new Set(leaves.items.map((it) => it.stamp)).size >= 3);
  assert.ok(new Set(leaves.items.map((it) => it.rotate)).size >= 5);
  const drops = get('drops');
  assert.ok(stampNames(drops).has('Drop'));
  assert.ok(new Set(drops.items.map((it) => it.colors[0])).size >= 2);
  const squiggles = stampNames(get('squiggles'));
  assert.ok(squiggles.has('Wave') && squiggles.has('Zigzag'));
});

test('scales has a Scale stamp: the Petal arch filled, then stroked', () => {
  const petal = BASIC_STAMPS.find((s) => s.name === 'Petal arch')!;
  const scale = get('scales').stamps.find((s) => s.name === 'Scale')!;
  assert.equal(scale.parts[0]!.d, petal.parts[0]!.d);
  assert.ok(scale.parts.length >= 2);
  assert.equal(scale.parts[0]!.paint, 'fill');
  assert.ok(scale.parts.slice(1).some((p) => p.paint === 'stroke'));
});

test('scales: the flipped items come last, each over an unflipped item at the same place', () => {
  const items = get('scales').items;
  const first = items.findIndex((it) => it.flip);
  assert.ok(first > 0);
  assert.ok(items.slice(first).every((it) => it.flip));
  for (const it of items.slice(first))
    assert.ok(items.slice(0, first).some((o) => !o.flip && o.x === it.x && o.y === it.y && o.scale === it.scale && o.rotate === it.rotate));
});

test('examples.ts uses no randomness, clock or DOM', () => {
  const src = readFileSync(new URL('./examples.ts', import.meta.url), 'utf8');
  for (const word of ['Math.random', 'Date', 'document', 'window']) assert.ok(!src.includes(word), word);
});
