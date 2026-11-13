// Ramer-Douglas-Peucker polyline simplification. Apart from vectorize.ts, so the built-in patterns can use it
// without loading the vectorizer.
import type { Pt } from './patterns/util.ts';

function segmentDistance([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

export function simplify(poly: readonly Pt[], tolerance: number): Pt[] {
  if (tolerance <= 0 || poly.length < 3) return [...poly];
  const keep = new Uint8Array(poly.length);
  keep[0] = 1;
  keep[poly.length - 1] = 1;
  const stack: [number, number][] = [[0, poly.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop() ?? [0, 0];
    let worst = -1;
    let far = 0;
    for (let i = a + 1; i < b; i++) {
      const d = segmentDistance(poly[i] as Pt, poly[a] as Pt, poly[b] as Pt);
      if (d > far) {
        far = d;
        worst = i;
      }
    }
    if (worst >= 0 && far > tolerance) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return poly.filter((_, i) => keep[i] === 1);
}
