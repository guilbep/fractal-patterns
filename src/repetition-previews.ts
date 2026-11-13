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

// At most 12 cards: 4 strengths, 2 toggles, 3 offsets, 3 sliders (each shown at its current value).
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
  if (a.jitter) cards.push({ id: 'jitter', group: 'jitter', label: 'Shift and scale', options: { ...current } });
  if (a.weights) cards.push({ id: 'weights', group: 'weights', label: 'Line weight', options: { ...current } });
  if (a.skip) cards.push({ id: 'skip', group: 'skip', label: 'Empty cells', options: { ...current } });
  return cards;
}
