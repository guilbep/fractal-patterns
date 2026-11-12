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
