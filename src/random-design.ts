// The random choices of the "Random pattern" and "Random layout" buttons, and the Layout examples. Pure: rnd is Math.random or a seeded generator.
import type { Kind } from './fractal.ts';
import type { Layer2Settings } from './layers.ts';
import type { Motion } from './motion.ts';
import { MOTION_NONE } from './motion.ts';
import { optionsFor } from './repetition.ts';
import { canVary, shiftsFor } from './supertile.ts';
import { STRENGTHS, VARIANT_DEFAULTS, type VariantOptions } from './variants.ts';

type Rnd = () => number;
const pick = <T>(rnd: Rnd, list: readonly T[]): T => list[Math.floor(rnd() * list.length) % list.length] as T;
const between = (rnd: Rnd, lo: number, hi: number, step: number): number => {
  const n = Math.round((lo + rnd() * (hi - lo)) / step) * step;
  return Number(Math.min(hi, Math.max(lo, n)).toFixed(2)) + 0; // + 0 turns -0 into 0
};

export interface RandomRepetition {
  readonly variants: boolean;
  readonly variantOptions: VariantOptions;
  readonly layer2: boolean;
  // Only the fields the button changes; offset and depth keep their value.
  readonly layer2Settings: Pick<Layer2Settings, 'scale' | 'rotate' | 'opacity'> | null;
}

// Empty cells stay 0: holes look like a defect. Options the kind ignores keep their default.
export function randomRepetition(kind: Kind, rnd: Rnd): RandomRepetition {
  const can = canVary(kind);
  const variants = can && rnd() < 0.5;
  let variantOptions: VariantOptions = { ...VARIANT_DEFAULTS };
  if (variants) {
    const ok = optionsFor(kind);
    const { cells, count } = pick(rnd, STRENGTHS.slice(0, 3));
    const drop = ok.drop ? pick(rnd, ['none', 'half-drop', 'brick'] as const) : 'none';
    variantOptions = {
      ...variantOptions,
      cells,
      count,
      orient: ok.orient && rnd() < 0.5,
      drop,
      shift: drop === 'none' ? 2 : pick(rnd, shiftsFor(cells)),
      jitter: ok.jitter && rnd() < 0.5 ? between(rnd, 0.2, 0.6, 0.01) : 0,
      weights: ok.weights && rnd() < 0.5 ? between(rnd, 0.2, 0.5, 0.01) : 0,
    };
  }
  const layer2 = rnd() < 1 / 3;
  let layer2Settings: RandomRepetition['layer2Settings'] = null;
  if (layer2) {
    // A size factor away from 1, so the two grids do not line up: 0.6 to 0.85 or 1.15 to 1.8 (slider step 0.05).
    const scale = rnd() < 0.5 ? between(rnd, 0.6, 0.85, 0.05) : between(rnd, 1.15, 1.8, 0.05);
    layer2Settings = { scale, rotate: pick(rnd, [0, 30, 45, 90]), opacity: between(rnd, 0.4, 0.8, 0.01) };
  }
  return { variants, variantOptions, layer2, layer2Settings };
}

// The Layout examples and "Random layout": transform and motion; spacing goes back to its defaults with an example.
export const LAYOUT_EXAMPLES: readonly { readonly label: string; readonly motion: Motion }[] = [
  { label: 'Plain', motion: MOTION_NONE },
  { label: 'Diagonal', motion: { ...MOTION_NONE, rotate: 45, scale: 1.2 } },
  { label: 'Tilted floor', motion: { ...MOTION_NONE, tilt: 55, rotate: 0, scale: 1.4 } },
  { label: 'Slow drift', motion: { ...MOTION_NONE, drift: 'xy', speed: 24, rotate: -12 } },
];

// Never turns drift on: motion costs energy on the visitor's device and needs a deliberate choice.
// Only the transform: drift and speed keep their value.
export function randomLayout(rnd: Rnd): Pick<Motion, 'rotate' | 'scale' | 'skew' | 'tilt'> {
  return {
    rotate: between(rnd, -45, 45, 5),
    scale: between(rnd, 0.8, 1.6, 0.05),
    skew: rnd() < 2 / 3 ? 0 : between(rnd, -15, 15, 1),
    tilt: rnd() < 2 / 3 ? 0 : between(rnd, 20, 55, 1),
  };
}
