// APCA through the official apca-w3 package, unmodified, under its own license (not MIT): see THIRD-PARTY-NOTICES.md.
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { parseHex } from './contrast.ts';
import { plateSurfaces, surfaceColors } from './fills.ts';
import type { FilledRoles, Spots } from './pairing.ts';

// Set at build time by vite.config.ts; plain node --test has no define.
export const APCA_VERSION: string = typeof __APCA_VERSION__ !== 'undefined' ? __APCA_VERSION__ : 'unknown';

// Signed Lc: text first, background second. Positive: dark text on light; negative: light text on dark.
export function apcaLc(textHex: string, backgroundHex: string): number {
  return APCAcontrast(sRGBtoY(parseHex(textHex)), sRGBtoY(parseHex(backgroundHex)));
}

// The Lc of lowest magnitude over the surfaces textWorst (pairing.ts) checks for WCAG.
export function apcaWorst(r: FilledRoles, opacity: number, plate: number, spots: Spots = (o) => [o]): number {
  const fill = r.fill ?? null;
  const fillSpots = fill === null ? [0] : spots(r.fillOpacity ?? 1);
  let worst = Infinity;
  for (const x of spots(opacity))
    for (const y of fillSpots)
      for (const c of surfaceColors(
        plateSurfaces({ background: r.background, pattern: r.pattern, patternOpacity: x, fill, fillOpacity: y }, plate),
      )) {
        const lc = apcaLc(r.text, c);
        if (Math.abs(lc) < Math.abs(worst)) worst = lc;
      }
  return worst;
}

// Rounded to a whole number, as the APCA documents allow; the sign stays for polarity.
export const lcText = (lc: number): string => `Lc ${Math.round(lc)}`;
export const polarity = (lc: number): string => (lc > 0 ? 'dark text on light' : lc < 0 ? 'light text on dark' : 'no polarity');
