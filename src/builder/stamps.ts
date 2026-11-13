// The stamp library of the pattern builder: built-in basic shapes, the wallpaper
// studio's generated motifs, and stamps from a person's own SVG file or traced image.
// Pure: no DOM, no clock, no randomness. Every path that leaves passes safePathData.
import { safePathData } from '../motifgrid.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS, makeMotif } from '../studio/motifs.ts';
import { SEA_FAMILIES, SEA_LABELS, makeSeaMotif } from '../studio/motifs-sea.ts';
import { ORCHARD_FAMILIES, ORCHARD_LABELS, makeOrchardMotif } from '../studio/motifs-orchard.ts';
import { importSvg } from '../studio/svg-import.ts';
import type { Stamp, StampPart } from './types.ts';

const INK = '#333333';
const HEX = /^#[0-9a-f]{6}$/i;
const color = (c: string) => (HEX.test(c) ? c : INK);
const basic = (name: string, paint: 'fill' | 'stroke', d: string): Stamp => ({ name, box: 100, parts: [{ d, paint, color: INK }] });

export const BASIC_STAMPS: readonly Stamp[] = [
  basic('Dot', 'fill', 'M50 20C66.57 20 80 33.43 80 50S66.57 80 50 80S20 66.57 20 50S33.43 20 50 20z'),
  basic('Ring', 'stroke', 'M50 22C65.46 22 78 34.54 78 50S65.46 78 50 78S22 65.46 22 50S34.54 22 50 22z'),
  basic('Square', 'fill', 'M20 20h60v60H20z'),
  basic('Triangle', 'fill', 'M50 15L85 80H15z'),
  basic('Diamond', 'fill', 'M50 10L85 50L50 90L15 50z'),
  basic('Drop', 'fill', 'M50 8C50 8 80 44 80 64C80 80 66 92 50 92C34 92 20 80 20 64C20 44 50 8 50 8z'),
  basic('Leaf', 'fill', 'M50 8C80 30 80 70 50 92C20 70 20 30 50 8z'),
  basic('Petal arch', 'fill', 'M15 90V55C15 35 40 30 50 10C60 30 85 35 85 55V90z'),
  basic('Dash', 'stroke', 'M50 20V80'),
  basic('Wave', 'stroke', 'M10 50c5-20 15-20 20 0s15 20 20 0s15-20 20 0s15 20 20 0'),
  basic('Zigzag', 'stroke', 'M10 70L23 30L36 70L50 30L63 70L76 30L90 70'),
  basic('Plus', 'stroke', 'M50 15V85M15 50H85'),
];

const motifStamp = (name: string, m: { silhouette: { d: string }; detail: { d: string } }): Stamp => {
  const parts: StampPart[] = [];
  const fill = safePathData(m.silhouette.d);
  const detail = safePathData(m.detail.d);
  if (fill) parts.push({ d: fill, paint: 'fill', color: '#7a9e87' });
  if (detail) parts.push({ d: detail, paint: 'stroke', color: '#2f3e36' });
  return { name, box: 100, parts };
};

/** One stamp per studio family: floral, then sea, then orchard. */
export function studioStamps(seed: number): Stamp[] {
  return [
    ...MOTIF_FAMILIES.map((f) => motifStamp(MOTIF_LABELS[f], makeMotif(f, seed))),
    ...SEA_FAMILIES.map((f) => motifStamp(SEA_LABELS[f], makeSeaMotif(f, seed))),
    ...ORCHARD_FAMILIES.map((f) => motifStamp(ORCHARD_LABELS[f], makeOrchardMotif(f, seed))),
  ];
}

const stampName = (name: string) => name.replace(/\.svg$/i, '').slice(0, 60);

/** A stamp from a person's own SVG file (untrusted: importSvg rebuilds every path from numbers). */
export function stampFromSvg(text: string, name: string): Stamp | null {
  const imp = importSvg(text);
  if (!imp) return null;
  // ponytail: the file's stroke widths are dropped; the design has one stroke width for all stroke parts.
  const parts: StampPart[] = [];
  for (const s of imp.shapes) {
    const d = safePathData(s.d);
    if (d) parts.push({ d, paint: s.paint, color: color(s.color) });
  }
  return parts.length ? { name: stampName(name), box: imp.box, parts } : null;
}

/** A stamp from a traced image: all parts are fills. */
export function stampFromShapes(
  shapes: readonly { readonly color: string; readonly d: string; readonly evenodd?: boolean }[],
  box: number,
  name: string,
): Stamp | null {
  const parts: StampPart[] = [];
  for (const s of shapes) {
    const d = safePathData(s.d);
    if (d) parts.push({ d, paint: 'fill', color: color(s.color), ...(s.evenodd ? { evenodd: true } : {}) });
  }
  return parts.length ? { name: stampName(name), box, parts } : null;
}
