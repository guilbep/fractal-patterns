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

// The Wallpaper Studio's mark: a stem with two leaves and a five-petal bloom, in the logo's line style.
export function studioLogoSvg(o: Pick<LogoOptions, 'background' | 'color'> = LOGO_DEFAULT): string {
  const petals = [0, 72, 144, 216, 288].map((a) => `<ellipse cx="32" cy="11" rx="4" ry="6" transform="rotate(${a} 32 18)"/>`).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" rx="12" fill="${o.background}"/>` +
    `<g fill="none" stroke="${o.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M32 58V27M32 50C24 50 19 45 18 38C25 38 31 42 32 50M32 43C40 43 45 38 46 31C39 31 33 35 32 43"/>${petals}</g></svg>`
  );
}

// The Pattern Builder's mark: four placed shapes on a 2 x 2 grid (dot, square, triangle, ring), in the logo's line style.
export function builderLogoSvg(o: Pick<LogoOptions, 'background' | 'color'> = LOGO_DEFAULT): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" rx="12" fill="${o.background}"/>` +
    `<g fill="none" stroke="${o.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="20" cy="20" r="7" fill="${o.color}"/><rect x="37" y="13" width="14" height="14"/>` +
    `<path d="M20 37L28 51H12z"/><circle cx="44" cy="44" r="7"/></g></svg>`
  );
}
