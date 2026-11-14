// Color symmetry (Farris): the settings of the second way to draw the 17 symmetry kinds. Off is "Lines", today's
// drawing. The group is the kind itself and the recipe is the design's seed, so Shuffle gives a new recipe.
// Link keys, written only when on: cs (1), cw waves, cd detail, cb balance (0/1), cm render (b bands, w wheel), co order.
import { reactive } from 'vue';

export type ColorRender = 'bands' | 'wheel';

export const WAVES_MIN = 2;
export const WAVES_MAX = 8;
export const DETAIL_MIN = 1;
export const DETAIL_MAX = 6;
/** Color orders: 5 rotations of the palette, then the same 5 reversed. */
export const ORDERS = 10;

export const COLOR_SYM_DEFAULTS = { on: false, waves: 6, detail: 4, balance: true, render: 'bands' as ColorRender, order: 0 };

export const colorSym = reactive({ ...COLOR_SYM_DEFAULTS });

/** The 5 band colors, background band first: the palette rotated by `order` mod 5, reversed from order 5 on. */
export function orderedColors(colors: readonly string[], order: number): string[] {
  const five = Array.from({ length: 5 }, (_, i) => colors[i % Math.max(1, colors.length)] ?? '#808080');
  const o = ((Math.round(order) % ORDERS) + ORDERS) % ORDERS;
  const base = o >= 5 ? [...five].reverse() : five;
  return base.map((_, i) => base[(i + o) % 5]!);
}
