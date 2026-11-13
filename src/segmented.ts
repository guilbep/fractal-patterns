/** Roving focus for a radio group: the index that a key moves to, skipping disabled options. */
export function nextIndex(count: number, current: number, key: string, disabled: readonly boolean[]): number {
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0;
  if (key === 'Home' || key === 'End') {
    const dir = key === 'Home' ? 1 : -1;
    for (let i = 0, j = dir === 1 ? 0 : count - 1; i < count; i++, j += dir) if (!disabled[j]) return j;
    return current;
  }
  if (!step) return current;
  for (let i = 1, j = current; i < count; i++) {
    j = (j + step + count) % count;
    if (!disabled[j]) return j;
  }
  return current;
}
