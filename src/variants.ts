// The "Reduce repetition" control: when it applies, its options, and the tile it gives. Pure.
import type { Kind } from './fractal.ts';
import { SUPER_CELLS, canVary, superTileSvg, type SuperTileOptions } from './supertile.ts';

export interface VariantsInput {
  readonly variants: boolean;
  readonly kind: Kind;
  readonly layout: 'single' | 'patchwork';
  readonly usingImage: boolean;
}

// Only a tile made of one kind and one seed can become a super tile.
// A traced image always can: every cell holds the same picture.
export const variantsActive = (d: VariantsInput): boolean => d.variants && (d.usingImage || (d.layout === 'single' && canVary(d.kind)));

// The options of the super tile the person sets; the defaults give today's 4 by 4 tile of 4 variants.
export interface VariantOptions {
  readonly cells: 2 | 4 | 6;
  readonly count: 2 | 4 | 6;
  readonly orient: boolean;
  readonly drop: 'none' | 'half-drop' | 'brick';
  readonly depths: boolean;
  readonly jitter: number; // 0..1
  readonly weights: number; // 0..1
  readonly skip: number; // 0..0.5
}
export const VARIANT_DEFAULTS: VariantOptions = {
  cells: 4,
  count: 4,
  orient: false,
  drop: 'none',
  depths: false,
  jitter: 0,
  weights: 0,
  skip: 0,
};

// The valid (cells, count) pairs of superTileSvg, as the Strength choices.
export const STRENGTHS = [
  { cells: 2, count: 2, label: 'Light: 2 variants, 2 by 2' },
  { cells: 4, count: 4, label: 'Medium: 4 variants, 4 by 4' },
  { cells: 6, count: 4, label: 'Wide: 4 variants, 6 by 6' },
  { cells: 6, count: 6, label: 'Strong: 6 variants, 6 by 6' },
] as const;

// o.size is the edge of one cell; the tile edge is the cell count times that.
export const variantTile = (o: SuperTileOptions): { svg: string; size: number } => ({
  svg: superTileSvg(o),
  size: (o.cells ?? SUPER_CELLS) * o.size,
});
