// The Patterns page kinds as builder stamps. Loaded on demand (dynamic import in StampPanel.vue),
// so the generators stay out of the builder's start JavaScript.
// ponytail: only the line geometry is carried over; the Patterns page's fills, second colors and curves are not.
import {
  FAMILIES,
  FAMILY_LABELS,
  KINDS,
  KIND_FAMILY,
  KIND_LABELS,
  MAX_DEPTH,
  extraPath,
  geometry,
  tileAspect,
  type Kind,
} from '../fractal.ts';
import { safePathData } from '../motifgrid.ts';
import type { Pt } from '../patterns/util.ts';
import { simplify } from '../simplify.ts';
import { pathBounds, transformPath } from '../studio/svg-import.ts';
import type { Stamp } from './types.ts';

const BOX = 100;
const MAX_D = 6000;
/** The cap for a dense kind (the wallpaper groups, scales, penrosearcs): the default cap of safePathData for a stroke motif. */
export const MAX_DENSE = 20000;
const TOLERANCES = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const n = (v: number) => String(+v.toFixed(1));

/** The polylines as path data; tolerance > 0 simplifies each one first, in units of the 100 box. */
function pathOf(kind: Kind, seed: number, depth: number, tolerance = 0): string {
  // The tile is BOX wide and BOX / aspect high: scale so the larger side is BOX, center the shorter one.
  const h = BOX / tileAspect(kind);
  const s = BOX / Math.max(BOX, h);
  const dx = (BOX - BOX * s) / 2;
  const dy = (BOX - h * s) / 2;
  const out: string[] = [];
  for (const raw of geometry({ kind, seed, depth, size: BOX })) {
    if (raw.length < 2) continue;
    const poly = raw.map(([x, y]): Pt => [x * s + dx, y * s + dy]);
    out.push((tolerance > 0 ? simplify(poly, tolerance) : poly).map(([x, y], i) => `${i ? 'L' : 'M'} ${n(x)} ${n(y)}`).join(' '));
  }
  return out.join(' ');
}

const stamp = (kind: Kind, d: string): Stamp => ({ name: KIND_LABELS[kind], box: BOX, parts: [{ d, paint: 'stroke', color: '#333333' }] });

/**
 * A kind drawn only with curves (penrosearcs): its extra path data, scaled and centered into the box.
 * Its arcs reach past the tile, so the fit uses the drawn bounds (arc extremes included), not the tile.
 */
function curveStamp(kind: Kind, seed: number): Stamp | null {
  for (let depth = Math.min(2, MAX_DEPTH[kind]); depth >= 1; depth--) {
    const raw = extraPath({ kind, seed, depth, size: BOX, precision: 1 });
    const b = pathBounds(raw);
    if (!b) continue;
    const s = BOX / Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const tx = (BOX - (b.maxX - b.minX) * s) / 2 - b.minX * s;
    const ty = (BOX - (b.maxY - b.minY) * s) / 2 - b.minY * s;
    const d = transformPath(raw, s, tx, ty);
    if (d && d.length <= MAX_DENSE) return stamp(kind, d);
  }
  return null;
}

/**
 * The kind as a one-part stroke stamp, at the largest depth (2 at most) whose path fits in MAX_D characters.
 * A denser kind is simplified at depth 1 with the smallest tolerance that fits in MAX_DENSE characters.
 */
export function patternStamp(kind: Kind, seed: number): Stamp | null {
  for (let depth = Math.min(2, MAX_DEPTH[kind]); depth >= 1; depth--) {
    const d = pathOf(kind, seed, depth);
    if (d.length > MAX_D) continue;
    if (!d) return curveStamp(kind, seed);
    if (safePathData(d) !== d) return null;
    return stamp(kind, d);
  }
  for (const tolerance of TOLERANCES) {
    const d = pathOf(kind, seed, 1, tolerance);
    if (d.length <= MAX_DENSE && safePathData(d) === d) return stamp(kind, d);
  }
  return null;
}

/** The kinds grouped by family, in the order of FAMILIES. */
export function patternStampList(): { family: string; label: string; kinds: { kind: Kind; label: string }[] }[] {
  return FAMILIES.map((family) => ({
    family,
    label: FAMILY_LABELS[family],
    kinds: KINDS.filter((k) => KIND_FAMILY[k] === family).map((kind) => ({ kind, label: KIND_LABELS[kind] })),
  }));
}
