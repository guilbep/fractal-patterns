import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studioInstances } from '../studio/model.ts';
import {
  addItem,
  designSvg,
  duplicateItem,
  duplicateMany,
  moveBy,
  moveMany,
  owners,
  parseDesign,
  removeItem,
  removeMany,
  reorder,
  reorderMany,
  toStudio,
  updateItem,
  updateMany,
} from './design.ts';
import type { Design, Item, Stamp } from './types.ts';

const A: Stamp = {
  name: 'A',
  box: 100,
  parts: [{ d: 'M10 10h80v80H10z', paint: 'fill', color: '#111111' }],
};
const B: Stamp = {
  name: 'B',
  box: 100,
  parts: [
    { d: 'M10 10h80v80H10z', paint: 'fill', color: '#222222' },
    { d: 'M20 50h60', paint: 'stroke', color: '#333333' },
  ],
};
const item = (id: number, stamp: number, x: number, y: number, colors: string[] = []): Item => ({
  id,
  stamp,
  x,
  y,
  scale: 0.2,
  rotate: 0,
  flip: false,
  opacity: 1,
  colors,
});
const base = {
  width: 200,
  height: 200,
  background: null,
  repeat: 'straight',
  strokeWidth: 2,
  stamps: [A, B],
} as const;
const fixture: Design = {
  ...base,
  items: [item(1, 0, 50, 50), item(2, 0, 100, 50), item(3, 1, 150, 50, ['#111111']), item(4, 0, 50, 150)],
};
const one = (x: number, y: number, repeat: Design['repeat'] = 'straight'): Design => ({ ...base, repeat, items: [item(1, 0, x, y)] });
const count = (s: string, sub: string): number => s.split(sub).length - 1;

test('toStudio without merge: one layer per (item, part)', () => {
  const s = toStudio(fixture, false);
  assert.equal(s.layers.length, 5);
  assert.deepEqual(owners(fixture), [0, 1, 2, 2, 3]);
  assert.equal(s.motifs.length, 3);
  assert.deepEqual(
    s.layers.map((l) => l.placements[0]?.motif),
    [0, 0, 1, 2, 0],
  );
});

test('toStudio merges consecutive layers with the same color, opacity and paint', () => {
  const s = toStudio(fixture);
  assert.deepEqual(
    s.layers.map((l) => l.color),
    ['#111111', '#333333', '#111111'],
  );
  assert.deepEqual(
    s.layers.map((l) => l.placements.length),
    [3, 1, 1],
  );
  const d = updateItem(fixture, 2, { opacity: 0.5 });
  assert.deepEqual(
    toStudio(d).layers.map((l) => l.placements.length),
    [1, 1, 1, 1, 1],
  );
});

test('seam wrap goes through the studio', () => {
  assert.equal(studioInstances(toStudio(one(0, 100))).length, 2);
  assert.equal(studioInstances(toStudio(one(0, 0))).length, 4);
  assert.equal(studioInstances(toStudio(one(100, 100))).length, 1);
});

test('designSvg', () => {
  const h = designSvg(one(100, 50, 'half-drop'));
  assert.ok(h.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"'), h);
  assert.equal(count(h, '<use '), 2);
  // At (100, 100) the shifted copy lands at (300, 0), on the top edge of the cell, so it is drawn at the bottom too.
  assert.equal(count(designSvg(one(100, 100, 'half-drop')), '<use '), 3);
  const s = designSvg(fixture);
  assert.ok(s.includes('<defs>'));
  assert.equal(count(s, '<use '), 5);
  assert.ok(s.includes('stroke-width="2"'));
});

test('mirror repeat: parsed and drawn as four copies', () => {
  const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
  assert.equal(parseDesign(json(one(50, 50, 'mirror')))?.repeat, 'mirror');
  const m = designSvg(one(50, 50, 'mirror'));
  assert.ok(m.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"'), m);
  assert.equal(count(m, '<use '), 4);
});

test('updateItem wraps, clamps and reduces', () => {
  const it = updateItem(fixture, 1, {
    x: -10,
    y: 210,
    rotate: 370,
    scale: 100,
    opacity: 2,
  }).items[0];
  assert.deepEqual([it?.x, it?.y, it?.rotate, it?.scale, it?.opacity], [190, 10, 10, 20, 1]);
  const m = moveBy(fixture, 1, -60, 0).items[0];
  assert.equal(m?.x, 190);
});

test('addItem ids', () => {
  const e = addItem({ ...base, items: [] }, 0, 10, 10);
  assert.equal(e.items[0]?.id, 1);
  assert.deepEqual(e.items[0], {
    id: 1,
    stamp: 0,
    x: 10,
    y: 10,
    scale: 1,
    rotate: 0,
    flip: false,
    opacity: 1,
    colors: [],
  });
  const f = addItem(fixture, 1, 10, 10);
  assert.equal(f.items.length, 5);
  assert.equal(f.items[4]?.id, 5);
});

test('duplicateItem goes right above the original, moved and wrapped', () => {
  const d = duplicateItem(fixture, 2);
  assert.equal(d.items.length, 5);
  assert.deepEqual([d.items[2]?.id, d.items[2]?.x, d.items[2]?.y], [5, 120, 70]);
  const w = duplicateItem(one(190, 195), 1).items[1];
  assert.deepEqual([w?.x, w?.y], [10, 15]);
});

test('reorder', () => {
  const ids = (d: Design): number[] => d.items.map((it) => it.id);
  assert.deepEqual(ids(reorder(fixture, 2, 'front')), [1, 3, 4, 2]);
  assert.deepEqual(ids(reorder(fixture, 2, 'back')), [2, 1, 3, 4]);
  assert.deepEqual(ids(reorder(fixture, 2, 'up')), [1, 3, 2, 4]);
  assert.deepEqual(ids(reorder(fixture, 2, 'down')), [2, 1, 3, 4]);
  assert.equal(reorder(fixture, 4, 'front'), fixture);
  assert.equal(reorder(fixture, 4, 'up'), fixture);
  assert.equal(reorder(fixture, 1, 'back'), fixture);
  assert.equal(reorder(fixture, 1, 'down'), fixture);
  assert.deepEqual(ids(removeItem(fixture, 3)), [1, 2, 4]);
});

test('operations are pure; an unknown id returns the same object', () => {
  const before = structuredClone(fixture);
  addItem(fixture, 0, 1, 1);
  updateItem(fixture, 1, { x: 5 });
  moveBy(fixture, 1, 5, 5);
  removeItem(fixture, 1);
  duplicateItem(fixture, 1);
  reorder(fixture, 1, 'front');
  toStudio(fixture);
  designSvg(fixture);
  assert.deepEqual(fixture, before);
  assert.equal(updateItem(fixture, 99, { x: 5 }), fixture);
  assert.equal(moveBy(fixture, 99, 5, 5), fixture);
  assert.equal(removeItem(fixture, 99), fixture);
  assert.equal(duplicateItem(fixture, 99), fixture);
  assert.equal(reorder(fixture, 99, 'front'), fixture);
});

test('parseDesign', () => {
  const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
  assert.deepEqual(parseDesign(json(fixture)), fixture);
  for (const bad of [null, 42, {}, { ...fixture, width: 5 }, { ...fixture, repeat: 'zigzag' }])
    assert.equal(parseDesign(json(bad)), null, JSON.stringify(bad)?.slice(0, 40));
  // Unsafe path data rejects the whole design.
  assert.equal(
    parseDesign(
      json({
        ...fixture,
        stamps: [A, { ...B, parts: [{ d: '<script>', paint: 'fill', color: '#000000' }] }],
      }),
    ),
    null,
  );
  assert.equal(parseDesign(json({ ...fixture, items: [{ ...item(1, 0, 1, 1), colors: ['red'] }] })), null);
  const p = parseDesign(
    json({
      ...fixture,
      stamps: [
        {
          ...A,
          name: 'x'.repeat(80),
          parts: [{ ...A.parts[0], d: '  M0 0h1  ' }],
        },
      ],
      items: [item(7, 0, 1, 1), item(7, 0, 2, 2), item(8, 5, 3, 3)],
    }),
  );
  assert.equal(p?.stamps[0]?.name.length, 60);
  assert.equal(p?.stamps[0]?.parts[0]?.d, 'M0 0h1');
  assert.deepEqual(
    p?.items.map((it) => it.id),
    [1, 2],
  );
});

test('source hygiene', () => {
  const src = readFileSync(new URL('./design.ts', import.meta.url), 'utf8');
  for (const w of ['Math.random', 'Date', 'document', 'window']) assert.ok(!src.includes(w), w);
});

test("parseDesign keeps overlap 'down'; a missing or unknown value leaves the key missing and the svg unchanged", () => {
  // Item at y 190, side 20: it crosses the bottom edge, so the order changes the instances.
  const d: Design = { ...fixture, items: [...fixture.items, item(5, 0, 100, 190)] };
  const round = (v: unknown): Design | null => parseDesign(JSON.parse(JSON.stringify(v)));
  const down = round({ ...d, overlap: 'down' })!;
  assert.equal(down.overlap, 'down');
  assert.equal(toStudio(down).overlap, 'down');
  assert.notDeepEqual(studioInstances(toStudio(down)), studioInstances(toStudio(d)));
  for (const v of [{ ...d, overlap: 'sideways' }, { ...d, overlap: 'none' }, d]) {
    const p = round(v)!;
    assert.ok(!('overlap' in p));
    assert.equal(designSvg(p), designSvg(d));
  }
  assert.equal(designSvg({ ...d, overlap: 'none' }), designSvg(d));
});

test('group operations wrap, keep order and leave the input unchanged', () => {
  const d: Design = { ...base, stamps: [A, B], items: [item(1, 0, 10, 10), item(2, 0, 100, 100), item(3, 0, 190, 50)] };
  const before = structuredClone(d);
  const at = (x: Design, id: number) => x.items.find((it) => it.id === id)!;

  const m = moveMany(d, [1, 3], 20, 0);
  assert.deepEqual([at(m, 1).x, at(m, 1).y], [30, 10]);
  assert.deepEqual([at(m, 3).x, at(m, 3).y], [10, 50]);
  assert.equal(at(m, 2), at(d, 2));

  const r = removeMany(d, [1, 2]);
  assert.deepEqual(
    r.items.map((it) => it.id),
    [3],
  );

  const { design: c, ids } = duplicateMany(d, [1, 3]);
  assert.equal(c.items.length, 5);
  assert.deepEqual(ids, [4, 5]);
  assert.equal(c.items[1]!.id, 4);
  assert.deepEqual([c.items[1]!.x, c.items[1]!.y], [30, 30]);
  assert.equal(c.items[4]!.id, 5);
  assert.deepEqual([c.items[4]!.x, c.items[4]!.y], [10, 70]);

  assert.deepEqual(
    reorderMany(d, [1, 2], 'front').items.map((it) => it.id),
    [3, 1, 2],
  );
  assert.deepEqual(
    reorderMany(d, [3], 'back').items.map((it) => it.id),
    [3, 1, 2],
  );

  const u = updateMany(d, [1, 2], { opacity: 0.5 });
  assert.deepEqual(
    u.items.map((it) => it.opacity),
    [0.5, 0.5, 1],
  );

  assert.deepEqual(d, before);
  assert.equal(moveMany(d, [], 5, 5), d);
  assert.equal(moveMany(d, [99], 5, 5), d);
  assert.equal(removeMany(d, []), d);
  assert.equal(duplicateMany(d, []).design, d);
  assert.equal(reorderMany(d, [], 'front'), d);
  assert.equal(updateMany(d, [], { opacity: 0.5 }), d);
});
