// The tile panel's pure part: fill the tile from the panel's choice, resize the tile, and the stamps in use.
import { gridFill } from './fill.ts';
import type { Design } from './types.ts';

export interface FillChoice {
  columns: number;
  rows: number;
  stampIndices: readonly number[];
  seed: number;
  size: number;
  sizeJitter: number;
  jitter: number;
  rotate: 'none' | 'quarter' | 'free';
  stagger: boolean;
  flip: boolean;
  /** null: keep each stamp's own colors. Else palette[0] is the background and the rest color the shapes. */
  palette: readonly string[] | null;
}

/** Replaces every item with a seeded grid fill. No usable stamp: the same design object. */
export function fillDesign(d: Design, c: FillChoice): Design {
  const stamps = c.stampIndices
    .filter((i) => d.stamps[i] !== undefined)
    .map((index) => {
      const s = d.stamps[index]!;
      return { index, box: s.box, parts: s.parts.length };
    });
  if (stamps.length === 0) return d;
  const items = gridFill({
    width: d.width,
    height: d.height,
    columns: c.columns,
    rows: c.rows,
    stamps,
    seed: c.seed,
    size: c.size,
    sizeJitter: c.sizeJitter,
    jitter: c.jitter,
    rotate: c.rotate,
    stagger: c.stagger,
    flip: c.flip,
    colors: c.palette ? c.palette.slice(1) : [],
    firstId: 1,
  });
  return { ...d, background: c.palette?.[0] ?? d.background, items };
}

/** Rounds and clamps the size to 16..2000; the items keep their relative place, and their scale. */
export function resizeDesign(d: Design, width: number, height: number): Design {
  const clamp = (v: number): number => Math.min(2000, Math.max(16, Math.round(v) || 16));
  const w = clamp(width);
  const h = clamp(height);
  const sx = w / d.width;
  const sy = h / d.height;
  return { ...d, width: w, height: h, items: d.items.map((it) => ({ ...it, x: it.x * sx, y: it.y * sy })) };
}

/** Sorted distinct stamp indices of the items; all indices when there is no item. */
export function usedStamps(d: Design): number[] {
  if (d.items.length === 0) return d.stamps.map((_, i) => i);
  return [...new Set(d.items.map((it) => it.stamp))].sort((a, b) => a - b);
}
