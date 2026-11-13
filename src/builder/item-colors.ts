// Pure color helpers for the selected shape panel.
import type { Design, Item } from './types.ts';

/** Distinct lower-case colors in order of first use: the background, then each item part. */
export function usedColors(d: Design, max = 12): string[] {
  const seen = new Set<string>();
  if (d.background !== null) seen.add(d.background.toLowerCase());
  for (const it of d.items) {
    const s = d.stamps[it.stamp];
    if (s === undefined) continue;
    s.parts.forEach((p, i) => seen.add((it.colors[i] ?? p.color).toLowerCase()));
  }
  return [...seen].slice(0, max);
}

/** The item's new colors with part `index` set; one entry per part, missing ones filled from the part's own color. */
export function setPartColor(item: Item, partColors: readonly string[], index: number, color: string): string[] {
  return partColors.map((c, i) => (i === index ? color : (item.colors[i] ?? c)));
}

export function setAllColors(partColors: readonly string[], color: string): string[] {
  return partColors.map(() => color);
}
