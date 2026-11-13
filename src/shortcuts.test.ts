import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortcutFor } from './shortcuts.ts';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

test('shortcutFor: R shuffles and F is full screen, in both cases', () => {
  assert.equal(shortcutFor(key('r'), false), 'shuffle');
  assert.equal(shortcutFor(key('R'), false), 'shuffle');
  assert.equal(shortcutFor(key('f'), false), 'fullscreen');
  assert.equal(shortcutFor(key('F'), false), 'fullscreen');
  assert.equal(shortcutFor(key('x'), false), null);
});

test('shortcutFor: nothing while typing or with a modifier key', () => {
  assert.equal(shortcutFor(key('f'), true), null);
  assert.equal(shortcutFor(key('r'), true), null);
  for (const m of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    assert.equal(shortcutFor(key('f', { [m]: true }), false), null, m);
    assert.equal(shortcutFor(key('r', { [m]: true }), false), null, m);
  }
});
