// Pure math for the PNG export: canvas limits, strips, the clock fade, the strip offset.

// 16384 px per side: the Chromium and Firefox canvas side limit. 4096 * 4096 px of area:
// the iOS Safari canvas limit (an estimate from WebKit's stated maximum canvas area
// on iOS, 16 777 216 px; not measured here).
export const MAX_CANVAS_SIDE = 16384;
export const MAX_CANVAS_AREA = 16777216;

export function planStrips(
  width: number,
  height: number,
  maxArea = MAX_CANVAS_AREA,
  maxSide = MAX_CANVAS_SIDE,
): { ok: true; strips: { y: number; height: number }[] } | { ok: false; reason: string } {
  if (!(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0))
    return { ok: false, reason: `The size ${width} × ${height} is not a whole number of pixels.` };
  if (width > maxSide) return { ok: false, reason: `The width ${width} px is over the limit of ${maxSide} px.` };
  if (height > maxSide * 1000) return { ok: false, reason: `The height ${height} px is too large.` };
  const step = Math.min(height, Math.floor(maxArea / width));
  const strips: { y: number; height: number }[] = [];
  for (let y = 0; y < height; y += step) strips.push({ y, height: Math.min(step, height - y) });
  return { ok: true, strips };
}

// True when a phone browser (iOS Safari) may refuse a canvas this large: the UI can warn.
export function mayExceedMobileLimit(width: number, height: number): boolean {
  return width * height > MAX_CANVAS_AREA;
}

export function clockFadeStops(height: number, fraction = 0.32): { from: number; to: number } {
  return { from: 0, to: Math.round(height * fraction) };
}

export function patternOffset(y: number, tileHeight: number): number {
  return -(y % tileHeight) || 0; // || 0 turns -0 into 0
}
