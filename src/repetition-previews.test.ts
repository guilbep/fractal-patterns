import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUP_FIELDS, SLIDER_EXAMPLES, previewOptions } from './repetition-previews.ts';
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

test('a slider at 0 previews its example value, captioned; above 0 its own value, no caption', () => {
  const zero = previewOptions({ ...current, jitter: 0, weights: 0, skip: 0 }, 'carpet');
  for (const key of ['jitter', 'weights', 'skip'] as const) {
    const c = zero.find((x) => x.id === key)!;
    assert.equal(c.options[key], SLIDER_EXAMPLES[key]);
    assert.equal(c.example, true);
    const set = previewOptions(current, 'carpet').find((x) => x.id === key)!;
    assert.equal(set.options[key], current[key]);
    assert.equal(set.example, false);
  }
  assert.deepEqual(SLIDER_EXAMPLES, { jitter: 1, weights: 1, skip: 0.25 });
});
