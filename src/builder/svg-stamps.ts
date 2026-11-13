// A stamp from a person's own SVG file. Loaded on demand, when the first SVG file is chosen.
// Pure: no DOM, no clock, no randomness. Every path that leaves passes safePathData.
import { safePathData } from '../motifgrid.ts';
import { importSvg } from '../studio/svg-import.ts';
import { color, stampName } from './stamps.ts';
import type { Stamp, StampPart } from './types.ts';

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
