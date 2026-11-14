// Farris-style "Smooth wheel": the angle of f picks a palette colour, |f| shades it.

// Structural, so this module stays free of the field generator.
type Grid = { n: number; re: Float64Array; im: Float64Array };

export function hexToRgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.replace(/./g, (c) => c + c);
  const v = parseInt(s, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function wheelPixels(grid: Grid, colors: readonly string[]): Uint8ClampedArray {
  const { n, re, im } = grid;
  const count = n * n;
  const pal = colors.map(hexToRgb);
  const L = pal.length;
  const mag = new Float64Array(count);
  for (let k = 0; k < count; k++) mag[k] = Math.hypot(re[k]!, im[k]!);
  // Percentile, not max, so a few spikes do not darken the whole tile.
  const sorted = mag.slice().sort();
  const q95 = sorted[Math.min(count - 1, Math.floor(0.95 * count))]! || 1;
  const out = new Uint8ClampedArray(count * 4);
  for (let k = 0; k < count; k++) {
    const a = ((Math.atan2(im[k]!, re[k]!) + Math.PI) / (2 * Math.PI)) * L;
    const i0 = Math.floor(a);
    const t = a - i0;
    const c0 = pal[((i0 % L) + L) % L]!;
    const c1 = pal[(((i0 + 1) % L) + L) % L]!;
    const shade = Math.min(Math.max(0.35 + (0.9 * mag[k]!) / q95, 0), 1.15);
    for (let c = 0; c < 3; c++) {
      out[k * 4 + c] = Math.round((c0[c]! + (c1[c]! - c0[c]!) * t) * shade);
    }
    out[k * 4 + 3] = 255;
  }
  return out;
}

// Seam check for a repeated tile: wrap-around edge difference over the mean
// neighbour difference inside the tile. About 1 means no visible seam.
export function edgeSeam(pixels: Uint8ClampedArray, n: number): number {
  const diff = (p: number, q: number) =>
    Math.abs(pixels[p]! - pixels[q]!) + Math.abs(pixels[p + 1]! - pixels[q + 1]!) + Math.abs(pixels[p + 2]! - pixels[q + 2]!);
  const at = (i: number, j: number) => (j * n + i) * 4;
  let edge = 0;
  let inner = 0;
  for (let s = 0; s < n; s++) {
    edge += diff(at(0, s), at(n - 1, s)) + diff(at(s, 0), at(s, n - 1));
    for (let t = 0; t < n - 1; t++) {
      inner += diff(at(t, s), at(t + 1, s)) + diff(at(s, t), at(s, t + 1));
    }
  }
  const edgeMean = edge / (2 * n);
  const innerMean = inner / (2 * n * (n - 1));
  return innerMean === 0 ? (edgeMean === 0 ? 1 : Infinity) : edgeMean / innerMean;
}
