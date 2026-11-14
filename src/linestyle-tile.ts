// Lines with character, loaded on demand with patterns/linestyle.ts: a tile's lines as filled outlines that swell and
// taper (brush) or wobble a little first (hand). state.ts keeps only the reactive glue, so the start JavaScript stays.
import { brushOutlines } from '@/patterns/linestyle.ts';
import { mulberry32, wrap, type Poly, type Pt } from '@/patterns/util.ts';

const SALT = 0x5bd1e995; // the line style draws from its own stream of the design seed

// The outlines to fill with the nonzero rule. A rectangular tile (aspect = width / height) is squeezed into the size by
// size square, where wrap() and the strands work, as in interlace-tile.ts, and the outlines are stretched back.
// ponytail: the squeeze widens the lines across the stretch (by 1 / aspect on a hexagonal tile); outlining in the
// stretched plane needs centrelines() split from the outline in patterns/linestyle.ts.
export function lineOutlines(
  polys: readonly (readonly Pt[])[],
  o: { size: number; aspect: number; width: number; style: 'brush' | 'hand'; seed: number },
): Poly[] {
  const { size, aspect } = o;
  const squeezed = aspect === 1 ? (polys as Poly[]) : polys.map((p) => p.map(([x, y]): Pt => [x, y * aspect]));
  const out = brushOutlines(wrap(squeezed, size), size, { width: o.width, style: o.style, rnd: mulberry32((o.seed + SALT) >>> 0) });
  return aspect === 1 ? out : out.map((p) => p.map(([x, y]): Pt => [x, y / aspect]));
}
