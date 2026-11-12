// The "Reduce repetition" switch: when it applies, and the tile it gives. Pure.
import type { Kind } from './fractal.ts';
import { SUPER_CELLS, canVary, superTileSvg, type SuperTileOptions } from './supertile.ts';

export interface VariantsInput {
  readonly variants: boolean;
  readonly kind: Kind;
  readonly layout: 'single' | 'patchwork';
  readonly usingImage: boolean;
}

// Only a tile made of one kind and one seed can become a super tile.
export const variantsActive = (d: VariantsInput): boolean => d.variants && !d.usingImage && d.layout === 'single' && canVary(d.kind);

// o.size is the edge of one cell; the tile edge is SUPER_CELLS times that.
export const variantTile = (o: SuperTileOptions): { svg: string; size: number } => ({ svg: superTileSvg(o), size: SUPER_CELLS * o.size });
