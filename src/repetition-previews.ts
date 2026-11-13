// The preview cards of the Repetition panel: one card per choice, each the current options with that
// one choice applied on top. Pure.
import type { Kind } from './fractal.ts';
import { optionsFor } from './repetition.ts';
import { STRENGTHS, type VariantOptions } from './variants.ts';

export type CardGroup = 'strength' | 'orient' | 'depths' | 'drop' | 'jitter' | 'weights' | 'skip';
export interface PreviewCard {
  readonly id: string;
  readonly group: CardGroup;
  readonly label: string;
  readonly options: VariantOptions;
  readonly example?: boolean; // a slider at 0 previews a demonstration value instead, captioned "example"
}

// The option fields each group changes.
export const GROUP_FIELDS: Record<CardGroup, readonly (keyof VariantOptions)[]> = {
  strength: ['cells', 'count'],
  orient: ['orient'],
  depths: ['depths'],
  drop: ['drop'],
  jitter: ['jitter'],
  weights: ['weights'],
  skip: ['skip'],
};

const DROPS = [
  { drop: 'none', label: 'None' },
  { drop: 'half-drop', label: 'Half-drop' },
  { drop: 'brick', label: 'Brick' },
] as const;

// A slider at 0 would preview the same picture as the others: it shows this value instead.
export const SLIDER_EXAMPLES = { jitter: 1, weights: 1, skip: 0.25 } as const;
const SLIDERS = [
  ['jitter', 'Shift and scale'],
  ['weights', 'Line weight'],
  ['skip', 'Empty cells'],
] as const;

// At most 12 cards: 4 strengths, 2 toggles, 3 offsets, 3 sliders (each at its current value, or its example value at 0).
export function previewOptions(current: VariantOptions, kind: Kind): PreviewCard[] {
  const a = optionsFor(kind);
  if (!a.variants) return [];
  const cards: PreviewCard[] = STRENGTHS.map((s) => ({
    id: `strength-${s.cells}-${s.count}`,
    group: 'strength',
    label: s.label,
    options: { ...current, cells: s.cells, count: s.count },
  }));
  if (a.orient) cards.push({ id: 'orient', group: 'orient', label: 'Turn and flip each cell', options: { ...current, orient: true } });
  if (a.depths) cards.push({ id: 'depths', group: 'depths', label: 'Mix two depths', options: { ...current, depths: true } });
  if (a.drop)
    for (const d of DROPS) cards.push({ id: `drop-${d.drop}`, group: 'drop', label: d.label, options: { ...current, drop: d.drop } });
  for (const [key, label] of SLIDERS)
    if (a[key]) {
      const example = current[key] === 0;
      cards.push({ id: key, group: key, label, options: { ...current, [key]: example ? SLIDER_EXAMPLES[key] : current[key] }, example });
    }
  return cards;
}
