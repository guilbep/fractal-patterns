// Two pattern layers whose tile sizes share no common factor line up again only every a x b pixels.
export const PHI = (1 + Math.sqrt(5)) / 2;

export function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// The whole number above `size` closest to size * PHI that shares no factor with it; ties go to the smaller one.
export function secondSize(size: number): number {
  const r = Math.round(size);
  const target = size * PHI;
  let best = 0;
  // ponytail: linear scan; consecutive numbers are coprime, so a match sits within a few steps of the target.
  for (let c = Math.floor(size) + 1; c <= Math.ceil(target) + r; c++) {
    if (gcd(r, c) === 1 && (best === 0 || Math.abs(c - target) < Math.abs(best - target))) best = c;
  }
  return best;
}

export function repeatDistance(a: number, b: number): number {
  const x = Math.round(a);
  const y = Math.round(b);
  return (x / gcd(x, y)) * y;
}

// The second layer's own settings: offset in percent of its tile, extra degrees, a factor on its tile size,
// its opacity, and its drift speed relative to the first layer.
export interface Layer2Settings {
  readonly x: number; // 0 to 100
  readonly y: number; // 0 to 100
  readonly rotate: number; // -180 to 180
  readonly scale: number; // 0.5 to 3
  readonly opacity: number; // 0.1 to 1
  readonly depth: number; // 0.25 to 4
}
export const LAYER2_DEFAULTS: Layer2Settings = { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, depth: 1 };

// The second tile's size for a scale factor, coprime with round(size * scale).
export const scaledSecondSize = (size: number, scale: number): number => secondSize(Math.round(size * scale));

// Stroke opacity where `layers` copies at `opacity` overlap: 1 - (1 - o)^layers.
export function effectiveOpacity(opacity: number, layers: number): number {
  return 1 - (1 - opacity) ** layers;
}

// Where a stroke at `opacity` crosses a second-layer stroke at opacity * strength: 1 - (1 - o) * (1 - o * p).
export function crossOpacity(opacity: number, strength: number): number {
  return 1 - (1 - opacity) * (1 - opacity * strength);
}

// The stroke opacities a surface shows: the first layer alone, and with a second layer of `strength`,
// the second alone and the crossings. With strength 1 the second alone equals the first.
export function layerSpots(opacity: number, layers: number, strength = 1): number[] {
  if (layers <= 1) return [opacity];
  return strength === 1 ? [opacity, effectiveOpacity(opacity, layers)] : [opacity, opacity * strength, crossOpacity(opacity, strength)];
}

// Worst text contrast over a surface with spots under one layer and spots under all of them.
// A min over every spot, because contrast is not monotonic in opacity when the text lies between pattern and background.
export function layeredWorst(contrastAt: (opacity: number) => number, opacity: number, layers: number, strength = 1): number {
  return Math.min(...layerSpots(opacity, layers, strength).map(contrastAt));
}
