// APCA through the official apca-w3 package, unmodified, under its own license (not MIT): see THIRD-PARTY-NOTICES.md.
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { parseHex, relativeLuminance } from './contrast.ts';
import { textSurfaces, type FilledRoles, type Score, type Spots } from './pairing.ts';

// Set at build time by vite.config.ts; plain node --test has no define.
export const APCA_VERSION: string = typeof __APCA_VERSION__ !== 'undefined' ? __APCA_VERSION__ : 'unknown';

// Signed Lc: text first, background second. Positive: dark text on light; negative: light text on dark.
export function apcaLc(textHex: string, backgroundHex: string): number {
  return APCAcontrast(sRGBtoY(parseHex(textHex)), sRGBtoY(parseHex(backgroundHex)));
}

// The Lc of lowest magnitude over the surfaces textWorst (pairing.ts) checks for WCAG.
export function apcaWorst(r: FilledRoles, opacity: number, plate: number, spots: Spots = (o) => [o]): number {
  let worst = Infinity;
  for (const c of textSurfaces(r, opacity, plate, spots)) {
    const lc = apcaLc(r.text, c);
    if (Math.abs(lc) < Math.abs(worst)) worst = lc;
  }
  return worst;
}

// The fix search (pairing.ts) on absolute Lc: it only searches colors and reads Lc values from the package.
// Polarity stays: the sign of Lc says which end the text moves toward (dark text toward black, light toward white);
// at Lc 0 (the package clips low contrast to 0) the darker of text and background decides.
// The heading in 'split' mode gets the next lower level of the guidance list (90 gives 75, 75 gives 60, 60 gives 45).
// That is our inference from the APCA guidance levels the page shows (larger text needs a lower Lc), not an APCA rule.
export const APCA_SCORE: Score = {
  at: (r, opacity, plate, spots) => Math.abs(apcaWorst(r, opacity, plate, spots)),
  ends: (r) => {
    const lc = apcaLc(r.text, r.background);
    const dark = lc !== 0 ? lc > 0 : relativeLuminance(r.text) <= relativeLuminance(r.background);
    return [dark ? '#000000' : '#ffffff'];
  },
  lower: (target) => target - 15,
};

// Rounded to a whole number, as the APCA documents allow; the sign stays for polarity.
export const lcText = (lc: number): string => `Lc ${Math.round(lc)}`;
export const polarity = (lc: number): string => (lc > 0 ? 'dark text on light' : lc < 0 ? 'light text on dark' : 'no polarity');
