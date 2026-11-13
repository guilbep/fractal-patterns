// The Patterns page kinds as builder stamps. Loaded on demand (dynamic import in StampPanel.vue),
// so the generators stay out of the builder's start JavaScript.
// ponytail: only the line geometry is carried over; the Patterns page's fills, second colors and curves are not.
import { FAMILIES, FAMILY_LABELS, KINDS, KIND_FAMILY, KIND_LABELS, MAX_DEPTH, geometry, tileAspect, type Kind } from '../fractal.ts';
import { safePathData } from '../motifgrid.ts';
import type { Stamp } from './types.ts';

const BOX = 100;
const MAX_D = 6000;
const n = (v: number) => String(+v.toFixed(1));

function pathOf(kind: Kind, seed: number, depth: number): string {
  // The tile is BOX wide and BOX / aspect high: scale so the larger side is BOX, center the shorter one.
  const h = BOX / tileAspect(kind);
  const s = BOX / Math.max(BOX, h);
  const dx = (BOX - BOX * s) / 2;
  const dy = (BOX - h * s) / 2;
  const out: string[] = [];
  for (const poly of geometry({ kind, seed, depth, size: BOX })) {
    if (poly.length < 2) continue;
    out.push(poly.map(([x, y], i) => `${i ? 'L' : 'M'} ${n(x * s + dx)} ${n(y * s + dy)}`).join(' '));
  }
  return out.join(' ');
}

/** The kind as a one-part stroke stamp, at the largest depth (2 at most) whose path fits in MAX_D characters. */
export function patternStamp(kind: Kind, seed: number): Stamp | null {
  for (let depth = Math.min(2, MAX_DEPTH[kind]); depth >= 1; depth--) {
    const d = pathOf(kind, seed, depth);
    if (d.length > MAX_D) continue;
    if (!d || safePathData(d) !== d) return null;
    return { name: KIND_LABELS[kind], box: BOX, parts: [{ d, paint: 'stroke', color: '#333333' }] };
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
