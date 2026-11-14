// Accent variation over a super tile: the closed accent shapes of one tile are copied into every
// tile of a cells x cells super tile, and each copy is dropped, moved, scaled and turned from a
// seeded generator, so the eye stops seeing the small repeat. The base pattern is not touched. Pure.
//
// Formulas, with u a fresh draw in [0, 1) and every option 0 meaning no change:
//   drop:  the copy is skipped when u < drop / 100.
//   move:  translate by a vector of random angle and length u * move / 100 * 2r, where r is the
//          shape's radius (largest vertex distance from its centroid). So move 100 = up to one diameter.
//   scale: factor 1 + s * (2u - 1), s = scale / 100 * 0.4, so from 1 - s to 1 + s about the centroid.
//   turn:  angle (2u - 1) * pi * turn / 100, so up to +-180 degrees about the centroid.
// The centroid is the mean of the vertices, without the closing point.
// Five draws are made per copy, always in the same order, so one option never reshuffles another.
//
// Edges: the move is clamped so every shape stays whole inside [0, width) x [0, height). Clamping
// is simpler than wrapping (no split shapes, no duplicates) and fine for small moves of shapes that
// sit inside their tile. ponytail: a shape scaled or turned past the edge is also pushed back in,
// so near the edge its offset can exceed the move bound; wrap instead if large moves are wanted.
import { mulberry32, type Poly, type Pt } from './patterns/util.ts';

export interface AccentVary {
  readonly cells: number; // super tile edge in base tiles, 2..8
  readonly move: number; // 0..100
  readonly scale: number; // 0..100
  readonly drop: number; // percent of shapes removed, 0..60
  readonly turn: number; // 0..100
}
export const ACCENT_VARY_DEFAULTS: AccentVary = { cells: 6, move: 35, scale: 50, drop: 28, turn: 0 };

// Fixed offset on the seed, apart from supertile.ts's (seed * 7919 + 13), so other layers never shift.
const accentSeed = (seed: number): number => (seed * 7919 + 104729) >>> 0;
const EDGE = 1e-6;

export function varyAccent(
  tileShapes: Poly[],
  tileSize: number,
  tileHeight: number,
  vary: AccentVary,
  seed: number,
): { polys: Poly[]; width: number; height: number } {
  const n = Math.round(vary.cells);
  if (n <= 1) return { polys: tileShapes, width: tileSize, height: tileHeight };
  const width = n * tileSize;
  const height = n * tileHeight;
  const drop = vary.drop / 100;
  const s = (vary.scale / 100) * 0.4;
  const turn = (Math.PI * vary.turn) / 100;
  const move = vary.move / 100;
  const rnd = mulberry32(accentSeed(seed));
  const polys: Poly[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const ox = col * tileSize;
      const oy = row * tileHeight;
      for (const shape of tileShapes) {
        const uDrop = rnd();
        const uAngle = rnd();
        const uLen = rnd();
        const uScale = rnd();
        const uTurn = rnd();
        if (uDrop < drop) continue;
        if (s === 0 && turn === 0 && move === 0) {
          polys.push(shape.map(([x, y]): Pt => [x + ox, y + oy]));
          continue;
        }
        const pts = shape.length > 1 && shape[0]![0] === shape.at(-1)![0] && shape[0]![1] === shape.at(-1)![1] ? shape.slice(0, -1) : shape;
        let cx = 0;
        let cy = 0;
        for (const [x, y] of pts) {
          cx += x / pts.length;
          cy += y / pts.length;
        }
        let r = 0;
        for (const [x, y] of pts) r = Math.max(r, Math.hypot(x - cx, y - cy));
        const k = 1 + s * (2 * uScale - 1);
        const a = turn * (2 * uTurn - 1);
        const cos = Math.cos(a) * k;
        const sin = Math.sin(a) * k;
        const len = uLen * move * 2 * r;
        let tx = Math.cos(2 * Math.PI * uAngle) * len;
        let ty = Math.sin(2 * Math.PI * uAngle) * len;
        const out = shape.map(([x, y]): Pt => [cx + ox + (x - cx) * cos - (y - cy) * sin, cy + oy + (x - cx) * sin + (y - cy) * cos]);
        let x0 = Infinity,
          x1 = -Infinity,
          y0 = Infinity,
          y1 = -Infinity;
        for (const [x, y] of out) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
        tx = Math.min(width - EDGE - x1, Math.max(-x0, tx));
        ty = Math.min(height - EDGE - y1, Math.max(-y0, ty));
        polys.push(out.map(([x, y]): Pt => [x + tx, y + ty]));
      }
    }
  }
  return { polys, width, height };
}
