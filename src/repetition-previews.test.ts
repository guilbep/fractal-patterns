import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_FIELDS, previewOptions } from './repetition-previews.ts';
import { STRENGTHS, VARIANT_DEFAULTS, type VariantOptions } from './variants.ts';

const current: VariantOptions = { ...VARIANT_DEFAULTS, jitter: 0.3, weights: 0.2, skip: 0.1 };

test('a kind with every option gets every card, at most 12', () => {
  const cards = previewOptions(current, 'carpet');
  assert.equal(cards.length, 12);
  assert.equal(cards.filter((c) => c.group === 'strength').length, STRENGTHS.length);
  for (const g of ['orient', 'depths', 'jitter', 'weights', 'skip'] as const)
    assert.ok(
      cards.some((c) => c.group === g),
      g,
    );
  assert.deepEqual(
    cards.filter((c) => c.group === 'drop').map((c) => c.options.drop),
    ['none', 'half-drop', 'brick'],
  );
  assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
});

test('a kind without orient gets no turn card', () => {
  const cards = previewOptions(current, 'hex');
  assert.ok(!cards.some((c) => c.group === 'orient'));
  assert.deepEqual([...new Set(cards.map((c) => c.group))], ['strength', 'weights']);
});

test('each card changes only the field it names', () => {
  for (const kind of ['carpet', 'koch', 'dots', 'hex'] as const)
    for (const c of previewOptions(current, kind)) {
      const changed = (Object.keys(current) as (keyof VariantOptions)[]).filter((k) => c.options[k] !== current[k]);
      assert.ok(
        changed.every((k) => GROUP_FIELDS[c.group].includes(k)),
        `${kind} ${c.id}: ${changed.join()}`,
      );
    }
  const orient = previewOptions(current, 'carpet').find((c) => c.id === 'orient')!;
  assert.equal(orient.options.orient, true);
});
