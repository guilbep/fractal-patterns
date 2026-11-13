// Pure math of the builder stage: the view box and the turn-and-resize handle.
import { repeatCell, type Repeat } from '../studio/model.ts';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const mod = (a: number, m: number): number => ((a % m) + m) % m;

/**
 * The rotation and scale after dragging the handle from `start` to `now` around `center`.
 * Y grows downward, so a positive angle is clockwise on the screen, like an SVG rotation.
 */
export function handleTransform(
  center: readonly [number, number],
  start: readonly [number, number],
  now: readonly [number, number],
  startRotate: number,
  startScale: number,
  snap = 0,
): { rotate: number; scale: number } {
  const [cx, cy] = center;
  const r0 = Math.hypot(start[0] - cx, start[1] - cy);
  if (r0 < 1e-9) return { rotate: startRotate, scale: startScale };
  const turn = Math.atan2(now[1] - cy, now[0] - cx) - Math.atan2(start[1] - cy, start[0] - cx);
  let rotate = startRotate + (turn * 180) / Math.PI;
  if (snap > 0) rotate = Math.round(rotate / snap) * snap;
  rotate = mod(rotate, 360);
  const scale = clamp((startScale * Math.hypot(now[0] - cx, now[1] - cy)) / r0, 0.05, 20);
  return { rotate, scale };
}

/** The cell in the center plus half a cell on every side. */
export function viewBox(cellWidth: number, cellHeight: number): string {
  return `${-cellWidth / 2} ${-cellHeight / 2} ${2 * cellWidth} ${2 * cellHeight}`;
}

/** The stroke width of an invisible hit line: the drawn width, or `minPixels` on the screen if that is wider. */
export function hitStroke(strokeWidth: number, unitsPerPixel: number, minPixels = 14): number {
  return Math.max(strokeWidth, minPixels * unitsPerPixel);
}

/** The id after `current` in `ids`, wrapping around; with no (or an unknown) selection, the first or the last. */
export function stepSelection(ids: readonly number[], current: number | null, step: 1 | -1): number | null {
  if (!ids.length) return null;
  const k = current === null ? -1 : ids.indexOf(current);
  if (k < 0) return ids[step === 1 ? 0 : ids.length - 1]!;
  return ids[mod(k + step, ids.length)]!;
}

/** The nearest grid point (the tile split into `parts` on each side), wrapped into [0, width) x [0, height). */
export function snapPoint(x: number, y: number, width: number, height: number, parts: number): [number, number] {
  const sx = width / parts;
  const sy = height / parts;
  return [mod(Math.round(x / sx) * sx, width), mod(Math.round(y / sy) * sy, height)];
}

/** The 8 neighbor cells and the center as [ox, oy]: a row above is drawn before the row below. */
export function cellOrder(): [number, number][] {
  return [-1, 0, 1].flatMap((oy) => [-1, 0, 1].map((ox): [number, number] => [ox, oy]));
}

/**
 * The ids of the items whose center, in any repeat copy of the 9 cells around and in the center cell
 * (the repeat's cell: 2w x h for half-drop, w x 2h for brick, 2w x 2h for mirror),
 * lies inside the rectangle with corners (x0, y0) and (x1, y1), in tile units.
 */
export function itemsInRect(
  items: readonly { id: number; x: number; y: number }[],
  rect: { x0: number; y0: number; x1: number; y1: number },
  width: number,
  height: number,
  repeat: Repeat = 'straight',
): number[] {
  const [l, r] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
  const [t, b] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
  const cell = repeatCell({ width, height, repeat, background: null, motifs: [], layers: [] });
  return items
    .filter((it) =>
      cell.copies.some((c) => {
        const cx = mod(c.dx + (c.flipX ? width - it.x : it.x), cell.width);
        const cy = mod(c.dy + (c.flipY ? height - it.y : it.y), cell.height);
        return cellOrder().some(([ox, oy]) => {
          const x = cx + ox * cell.width;
          const y = cy + oy * cell.height;
          return x >= l && x <= r && y >= t && y <= b;
        });
      }),
    )
    .map((it) => it.id);
}
