// The wallpaper studio's generated motifs as builder stamps. Loaded on demand: the motif generators are large.
// Pure: no DOM, no clock, no randomness. Every path that leaves passes safePathData.
import { safePathData } from '../motifgrid.ts';
import { MOTIF_FAMILIES, MOTIF_LABELS, makeMotif } from '../studio/motifs.ts';
import { SEA_FAMILIES, SEA_LABELS, makeSeaMotif } from '../studio/motifs-sea.ts';
import { ORCHARD_FAMILIES, ORCHARD_LABELS, makeOrchardMotif } from '../studio/motifs-orchard.ts';
import type { Stamp, StampPart } from './types.ts';

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
