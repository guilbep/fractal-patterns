import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioHistory, isUndoKey } from './studio-history.ts';

// A manual clock: schedule stores the callback, tick() runs it.
function clocked<T>(initial: T, limit = 50) {
  let fn: (() => void) | null = null;
  const h = createStudioHistory(initial, {
    limit,
    schedule: (f) => (fn = f),
    cancel: () => (fn = null),
  });
  const tick = () => {
    const f = fn;
    fn = null;
    f?.();
  };
  return { h, tick };
}

test('changes with no pause between them make one entry', () => {
  const { h, tick } = clocked('S0');
  h.record('A');
  h.record('B');
  tick();
  assert.equal(h.undo(), 'S0');
  assert.equal(h.undo(), undefined);
});

test('undo and redo walk the committed states', () => {
  const { h, tick } = clocked('S0');
  h.record('S1');
  tick();
  h.record('S2');
  tick();
  assert.equal(h.undo(), 'S1');
  assert.equal(h.undo(), 'S0');
  assert.equal(h.undo(), undefined);
  assert.equal(h.redo(), 'S1');
});

test('undo commits a pending change first', () => {
  const { h } = clocked('S0');
  h.record('S1');
  assert.equal(h.canUndo(), true);
  assert.equal(h.undo(), 'S0');
  assert.equal(h.redo(), 'S1');
});

test('a new change after undo drops the redo branch', () => {
  const { h, tick } = clocked('S0');
  h.record('S1');
  tick();
  h.record('S2');
  tick();
  assert.equal(h.undo(), 'S1');
  h.record('S3');
  tick();
  assert.equal(h.canRedo(), false);
});

test('applying an undone state records nothing and keeps redo', () => {
  const { h, tick } = clocked('S0');
  h.record('S1');
  tick();
  const back = h.undo()!;
  h.record(back); // the watcher sees the applied state
  tick();
  assert.equal(h.canRedo(), true);
  assert.equal(h.redo(), 'S1');
});

test('the limit keeps the newest entries', () => {
  const { h, tick } = clocked('S0', 3);
  for (const s of ['S1', 'S2', 'S3', 'S4', 'S5']) {
    h.record(s);
    tick();
  }
  assert.equal(h.undo(), 'S4');
  assert.equal(h.undo(), 'S3');
  assert.equal(h.undo(), undefined);
});

test('a state equal to the current entry adds nothing', () => {
  const { h, tick } = clocked({ a: 1 });
  h.record({ a: 1 });
  assert.equal(h.canUndo(), false);
  tick();
  assert.equal(h.canUndo(), false);
});

test('reset clears the history', () => {
  const { h, tick } = clocked('S0');
  h.record('S1');
  tick();
  h.record('S2');
  tick();
  h.undo();
  h.reset('T');
  assert.equal(h.canUndo(), false);
  assert.equal(h.canRedo(), false);
});

test('isUndoKey matches the Patterns page shortcut', () => {
  const k = (key: string, m: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) => ({
    key,
    ctrlKey: !!m.ctrl,
    metaKey: !!m.meta,
    shiftKey: !!m.shift,
    altKey: !!m.alt,
  });
  assert.equal(isUndoKey(k('z', { ctrl: true }), false), 'undo');
  assert.equal(isUndoKey(k('z', { meta: true }), false), 'undo');
  assert.equal(isUndoKey(k('Z', { ctrl: true, shift: true }), false), 'redo');
  assert.equal(isUndoKey(k('z', { ctrl: true, shift: true }), false), 'redo');
  assert.equal(isUndoKey(k('z', { ctrl: true, alt: true }), false), null);
  assert.equal(isUndoKey(k('z'), false), null);
  assert.equal(isUndoKey(k('z', { ctrl: true }), true), null);
});
