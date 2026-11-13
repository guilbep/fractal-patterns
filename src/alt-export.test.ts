import { test } from 'node:test';
import assert from 'node:assert/strict';
import { altUnavailable } from './alt-export.ts';

const plain = { curves: false, extra: '', variants: false, layer2: false };

test('a plain design is available', () => assert.equal(altUnavailable(plain), null));
test('smooth curves block it', () => assert.match(altUnavailable({ ...plain, curves: true }) ?? '', /Smooth curves/));
test('an arc path blocks it', () => assert.match(altUnavailable({ ...plain, extra: 'M0 0a5 5 0 0 1 5 5' }) ?? '', /arcs/));
test('reduce repetition blocks it', () => assert.match(altUnavailable({ ...plain, variants: true }) ?? '', /Reduce repetition/));
test('a second layer blocks it', () => assert.match(altUnavailable({ ...plain, layer2: true }) ?? '', /second layer/));
