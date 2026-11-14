// Large tile: a field kind drawn over a period several times the tile size, with the same feature
// scale, so the repeat is far less visible. The cost is bytes, roughly the period squared.
import { KINDS, generate, hasLargeTile, type Kind } from './fractal.ts';

export const largeTileKinds = (): Kind[] => KINDS.filter(hasLargeTile);

// The SVG length of the large tile at the app's default stroke and precision (what the page would ship).
export const largeTileBytes = (kind: Kind, seed: number, depth: number, size: number, period: number): number =>
  generate({ kind, seed, depth, size, period, strokeWidth: 2, precision: 1, color: '#000000', opacity: 0.6 }).length;
