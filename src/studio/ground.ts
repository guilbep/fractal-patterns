// The ground layer: a quiet pattern of tiny foliage behind the plants (docs/research/wallpaper-repeats.md, item 2).
// A jittered grid, not random scatter: even cover with no holes and no clumps, while the seeded offset and rotation
// hide the grid lines. Placements are in tile coordinates, so the model's repeat copies (half-drop, brick, mirror)
// carry the ground with the rest of the tile and it wraps on every lattice by construction.
import { mulberry32 } from '../patterns/util.ts';
import type { Placement, StudioMotif } from './model.ts';

export type GroundTheme = 'floral' | 'sea' | 'orchard';

/** Grid cells per unit tile side. */
export const GROUND_GRID = 6;
/** Motif size as a share of the unit tile side. */
export const GROUND_SIZE = 0.05;
/** A placement stays in the middle 60 percent of its cell. */
export const GROUND_ZONE = 0.6;
/** The seeded rotations, in degrees. */
export const GROUND_ANGLES = [0, 30, 60, 90, 120, 150, 210, 270] as const;

const BOX = 10;
const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const LEAF = 'M5 0.5C8 3.5 8 6.5 5 9.5C2 6.5 2 3.5 5 0.5Z';
const SPRIG = dot(5, 2.5, 1.4) + dot(2.8, 6.8, 1.4) + dot(7.2, 6.8, 1.4);
const BLADE = 'M4.2 9.8C3 6.5 4.5 3 6.6 0.3C5.6 3.2 5 6.5 5.8 9.8Z';
const BUBBLES = dot(4, 6, 2.2) + dot(7.4, 2.8, 1.3) + dot(7.6, 7.6, 0.8);
const BLOSSOM = dot(5, 5, 2.6);

const MOTIFS: Record<GroundTheme, readonly string[]> = {
  floral: [LEAF, SPRIG],
  sea: [BLADE, BUBBLES],
  orchard: [LEAF, BLOSSOM],
};

/** The theme's ground motifs (filled, in a box of 10). */
export function groundMotifs(theme: GroundTheme): StudioMotif[] {
  return (MOTIFS[theme] ?? MOTIFS.floral).map((d) => ({ d, box: BOX, paint: 'fill' }));
}

/** One placement per grid cell over the tile (6 x 6 per unit tile), motif indices offset by `first`. */
export function groundLayer(o: {
  seed: number;
  width: number;
  height: number;
  span?: 1 | 2;
  theme?: GroundTheme;
  first?: number;
}): Placement[] {
  const span = o.span === 2 ? 2 : 1;
  const side = Math.min(o.width, o.height) / span;
  const nx = Math.max(1, Math.round((GROUND_GRID * o.width) / side));
  const ny = Math.max(1, Math.round((GROUND_GRID * o.height) / side));
  const cw = o.width / nx;
  const ch = o.height / ny;
  const kinds = groundMotifs(o.theme ?? 'floral').length;
  const rnd = mulberry32(o.seed ^ 0x5eed9a0d);
  const lo = (1 - GROUND_ZONE) / 2;
  const out: Placement[] = [];
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = (i + lo + GROUND_ZONE * rnd()) * cw;
      const y = (j + lo + GROUND_ZONE * rnd()) * ch;
      const motif = (o.first ?? 0) + Math.floor(rnd() * kinds);
      const rotate = GROUND_ANGLES[Math.floor(rnd() * GROUND_ANGLES.length)]!;
      const scale = ((GROUND_SIZE * side) / BOX) * (0.8 + 0.4 * rnd());
      out.push({
        motif,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        scale: Math.round(scale * 1000) / 1000,
        rotate,
        flip: false,
      });
    }
  return out;
}
