// Linear undo history: a list of values and a cursor on the current one.
export interface History<T> {
  push(value: T): void;
  undo(): T | undefined;
  redo(): T | undefined;
  current(): T;
  canUndo(): boolean;
  canRedo(): boolean;
  size(): number;
}

export function createHistory<T>(initial: T, limit = 50, same: (a: T, b: T) => boolean = Object.is): History<T> {
  const entries: T[] = [initial];
  let i = 0;
  const current = () => entries[i] as T;
  return {
    push(value) {
      if (same(current(), value)) return;
      entries.splice(i + 1, Infinity, value);
      if (entries.length > limit) entries.splice(0, entries.length - limit);
      i = entries.length - 1;
    },
    undo: () => (i > 0 ? entries[--i] : undefined),
    redo: () => (i < entries.length - 1 ? entries[++i] : undefined),
    current,
    canUndo: () => i > 0,
    canRedo: () => i < entries.length - 1,
    size: () => entries.length,
  };
}
