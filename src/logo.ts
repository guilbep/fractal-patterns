// The app's logo and favicon: one of its own patterns, drawn small and bold on a rounded square.
import { MAX_DEPTH, geometry, svgFromPolylines, type Kind } from './fractal.ts';
import { PALETTES } from './palettes.ts';

export interface LogoOptions {
  readonly kind: Kind;
  readonly seed: number;
  readonly background: string;
  readonly color: string;
}

const SIZE = 64;

export function logoSvg(o: LogoOptions): string {
  const polys = geometry({ kind: o.kind, seed: o.seed, depth: Math.min(2, MAX_DEPTH[o.kind]), size: SIZE });
  const svg = svgFromPolylines(polys, { size: SIZE, strokeWidth: 4, precision: 1, color: o.color, opacity: 1 });
  const rect = `<rect width="${SIZE}" height="${SIZE}" rx="12" fill="${o.background}"/>`;
  return svg.replace('>', `>${rect}`);
}

const LAGOON = (PALETTES.find((p) => p.name === 'Lagoon') ?? PALETTES[0]!).colors;

// Chosen from `npm run logo -- candidates`: see scripts/make-logo.ts.
export const LOGO_DEFAULT: LogoOptions = { kind: 'whirl', seed: 1, background: LAGOON[0]!, color: LAGOON[1]! };
