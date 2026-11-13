// Undo history for the Wallpaper Studio design, the same behavior as the Patterns page (src/state-share.ts):
// one entry per pause of `delay` ms, so a slider drag is one step.
import { createHistory } from '../history.ts';

export interface StudioHistory<T> {
  /** Call on every change with a fresh copy of the state (not a live reactive object); commits after `delay` ms of quiet. */
  record(state: T): void;
  /** Commit a pending change now. */
  flush(): void;
  /** Flushes first; returns the state to apply, or undefined. */
  undo(): T | undefined;
  redo(): T | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  /** A new history from this state (after a link opens a new design). */
  reset(state: T): void;
}

// Applying a state from undo() or redo() needs no flag: the watcher then records a state equal to the current
// entry, and an equal state never becomes an entry (so the redo branch stays).
export function createStudioHistory<T>(
  initial: T,
  o: {
    limit?: number;
    delay?: number;
    same?: (a: T, b: T) => boolean;
    schedule?: (fn: () => void, ms: number) => unknown;
    cancel?: (h: unknown) => void;
  } = {},
): StudioHistory<T> {
  const { limit = 50, delay = 300, same = (a: T, b: T) => JSON.stringify(a) === JSON.stringify(b) } = o;
  const schedule = o.schedule ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const cancel = o.cancel ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let history = createHistory(initial, limit, same);
  let pending: { state: T; timer: unknown } | null = null;

  const drop = () => {
    if (pending) cancel(pending.timer);
    pending = null;
  };
  const flush = () => {
    const p = pending;
    drop();
    if (p) history.push(p.state);
  };
  return {
    record(state) {
      drop();
      pending = { state, timer: schedule(flush, delay) };
    },
    flush,
    undo() {
      flush();
      return history.undo();
    },
    redo() {
      flush();
      return history.redo();
    },
    // A pending change is undoable at once: undo() commits it first.
    canUndo: () => history.canUndo() || (!!pending && !same(pending.state, history.current())),
    canRedo: () => history.canRedo() && (!pending || same(pending.state, history.current())),
    reset(state) {
      drop();
      history = createHistory(state, limit, same);
    },
  };
}

/** Ctrl/Cmd+Z undoes, with Shift redoes; Alt held or focus in a form field (native text undo) gives null. As App.vue onKey. */
export function isUndoKey(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean },
  inField: boolean,
): 'undo' | 'redo' | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || inField || e.key.toLowerCase() !== 'z') return null;
  return e.shiftKey ? 'redo' : 'undo';
}
