// The preview cards of the Repetition panel: one card per choice, each the current options with that
// one choice applied on top. Pure.
import type { Kind } from './fractal.ts';
import { imageOptions, optionsFor } from './repetition.ts';
import { shiftsFor } from './supertile.ts';
import { STRENGTHS, type VariantOptions } from './variants.ts';

export type CardGroup = 'strength' | 'orient' | 'depths' | 'drop' | 'shift' | 'jitter' | 'weights' | 'skip';
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
  shift: ['shift'],
  jitter: ['jitter'],
  weights: ['weights'],
  skip: ['skip'],
};

export const SHIFT_LABELS = { 2: 'One half', 3: 'One third', 4: 'One quarter' } as const;
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

// At most 14 cards: 4 strengths, 2 toggles, 3 offsets, 2 shifts (only with an offset and a grid that allows more than one), 3 sliders (each at its current value, or its example value at 0).
// `kind` null is a traced image: Strength is the grid size only, one card per cell count.
export function previewOptions(current: VariantOptions, kind: Kind | null): PreviewCard[] {
  const a = kind === null ? imageOptions(true) : optionsFor(kind);
  if (!a.variants) return [];
  const strengths = kind === null ? STRENGTHS.filter((s, i) => STRENGTHS.findIndex((t) => t.cells === s.cells) === i) : STRENGTHS;
  const cards: PreviewCard[] = strengths.map((s) => ({
    id: `strength-${s.cells}-${s.count}`,
    group: 'strength',
    label: kind === null ? `${s.cells} by ${s.cells}` : s.label,
    options: { ...current, cells: s.cells, count: s.count },
  }));
  if (a.orient) cards.push({ id: 'orient', group: 'orient', label: 'Turn and flip each cell', options: { ...current, orient: true } });
  if (a.depths) cards.push({ id: 'depths', group: 'depths', label: 'Mix two depths', options: { ...current, depths: true } });
  if (a.drop)
    for (const d of DROPS) cards.push({ id: `drop-${d.drop}`, group: 'drop', label: d.label, options: { ...current, drop: d.drop } });
  const shifts = shiftsFor(current.cells);
  if (a.drop && current.drop !== 'none' && shifts.length > 1)
    for (const q of shifts) cards.push({ id: `shift-${q}`, group: 'shift', label: SHIFT_LABELS[q], options: { ...current, shift: q } });
  for (const [key, label] of SLIDERS)
    if (a[key]) {
      const example = current[key] === 0;
      cards.push({ id: key, group: key, label, options: { ...current, [key]: example ? SLIDER_EXAMPLES[key] : current[key] }, example });
    }
  return cards;
}
