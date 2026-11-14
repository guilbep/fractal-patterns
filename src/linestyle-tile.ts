// Lines with character, loaded on demand with patterns/linestyle.ts: a tile's lines as filled outlines that swell and
// taper (brush) or wobble a little first (hand). state.ts keeps only the reactive glue, so the start JavaScript stays.
import { centrelines, outlineCentrelines } from '@/patterns/linestyle.ts';
import { mulberry32, wrap, type Poly, type Pt } from '@/patterns/util.ts';

const SALT = 0x5bd1e995; // the line style draws from its own stream of the design seed

// The outlines to fill with the nonzero rule. A rectangular tile (aspect = width / height) is squeezed into the size by
// size square, where wrap() and the strands work, as in interlace-tile.ts. Only the centrelines are stretched back:
// outlining in the real tile keeps the width the same in every direction.
export function lineOutlines(
  polys: readonly (readonly Pt[])[],
  o: { size: number; aspect: number; width: number; style: 'brush' | 'hand'; seed: number },
): Poly[] {
  const { size, aspect } = o;
  const squeezed = aspect === 1 ? (polys as Poly[]) : polys.map((p) => p.map(([x, y]): Pt => [x, y * aspect]));
  const cs = centrelines(wrap(squeezed, size), size, { width: o.width, style: o.style, rnd: mulberry32((o.seed + SALT) >>> 0) });
  if (aspect === 1) return outlineCentrelines(cs, size, size);
  // ponytail: the profile and the hand wobble are laid out in the squeezed square, so they run up to 1 / aspect longer
  // across the stretch; fine by eye, lay them out after the stretch if that ever shows.
  const st = (p: Pt): Pt => [p[0], p[1] / aspect];
  return outlineCentrelines(
    cs.map((c) => ({ ...c, base: c.base.map(st), pts: c.pts.map(st), shift: st(c.shift) })),
    size,
    size / aspect,
  );
}
