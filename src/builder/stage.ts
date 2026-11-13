// Pure math of the builder stage: the view box and the turn-and-resize handle.

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
