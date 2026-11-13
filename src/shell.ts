// Pure logic for the page shell: tab ids and palette stepping.

export const TAB_IDS = ['pattern', 'repetition', 'layout', 'colors', 'image', 'export'] as const;
export type TabId = (typeof TAB_IDS)[number];

// Old stored tab ids that moved: Motion now lives in Layout.
const MOVED: Readonly<Record<string, TabId>> = { motion: 'layout' };

export function migrateTab(stored: string | null): TabId {
  if (stored === null) return 'pattern';
  return TAB_IDS.find((t) => t === stored) ?? MOVED[stored] ?? 'pattern';
}

// Index of the next (step 1) or previous (step -1) palette, with wrap.
// A custom palette (index -1) steps to the first palette either way.
export function stepPalette(index: number, step: 1 | -1, count: number): number {
  if (index < 0) return 0;
  return (index + step + count) % count;
}
