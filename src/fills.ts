// Fills for closed shapes in a second color, and the text contrast over every surface they create.
// Pure: no DOM access.
import { blend, contrastRatio } from './contrast.ts';
import type { Pt } from './patterns/util.ts';
import { squareScene, type Scene, type SceneLayer } from './scene.ts';

const EPS = 1e-9;

export function isClosed(poly: readonly Pt[]): boolean {
  const first = poly[0];
  const last = poly[poly.length - 1];
  return poly.length >= 4 && !!first && !!last && Math.abs(first[0] - last[0]) <= EPS && Math.abs(first[1] - last[1]) <= EPS;
}

// Shoelace formula; 0 for an open polyline.
export function polygonArea(poly: readonly Pt[]): number {
  if (!isClosed(poly)) return 0;
  let s = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[i + 1]!;
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

export function splitClosed(polys: readonly (readonly Pt[])[], minArea = 0): { closed: Pt[][]; open: Pt[][] } {
  const closed: Pt[][] = [];
  const open: Pt[][] = [];
  for (const p of polys) (polygonArea(p) > minArea ? closed : open).push([...p]);
  return { closed, open };
}

export interface FillStyle {
  readonly mode: 'none' | 'closed' | 'alternate';
  readonly color: string;
  readonly opacity: number;
}

export const NO_FILL: FillStyle = { mode: 'none', color: '#000000', opacity: 1 };

// The shapes a kind marks as accent (fractal.ts), filled in their own color at full opacity.
export interface AccentShapes {
  readonly polys: readonly (readonly Pt[])[];
  readonly color: string;
}

// 'alternate' fills closed shapes 0, 2, 4, … in their order: a checker-like rhythm on regular grids.
// Layers from the bottom: fill, accent, strokes. Without fill and accent shapes the scene is the stroke scene alone.
export function fillScene(
  polys: readonly (readonly Pt[])[],
  o: { readonly size: number; readonly strokeWidth: number; readonly color: string; readonly opacity: number; readonly height?: number },
  fill: FillStyle,
  accent?: AccentShapes,
): Scene {
  // `height` other than `size` for a rectangular tile.
  const stroke = { ...squareScene(polys, o), height: o.height ?? o.size };
  const under: SceneLayer[] = [];
  if (fill.mode !== 'none') {
    const { closed } = splitClosed(polys);
    const shapes = fill.mode === 'alternate' ? closed.filter((_, i) => i % 2 === 0) : closed;
    if (shapes.length > 0) under.push({ polys: shapes, paint: { mode: 'fill', color: fill.color, opacity: fill.opacity, width: 0 } });
  }
  if (accent && accent.polys.length > 0)
    under.push({ polys: accent.polys, paint: { mode: 'fill', color: accent.color, opacity: 1, width: 0 } });
  return under.length === 0 ? stroke : { ...stroke, layers: [...under, ...stroke.layers] };
}

export interface Surfaces {
  readonly background: string;
  readonly pattern: string;
  readonly patternOpacity: number;
  readonly fill: string | null;
  readonly fillOpacity: number;
  // Optional, so the Surfaces built before the accent need no change. accentOpacity: 1 unless under a plate.
  readonly accent?: string | null;
  readonly accentOpacity?: number;
}

const fillSurface = (s: Surfaces): string | null => (s.fill === null ? null : blend(s.fill, s.background, s.fillOpacity));

// Every color that can lie under the text. Duplicates may stay.
export function surfaceColors(s: Surfaces): string[] {
  const out = [s.background];
  const f = fillSurface(s);
  if (f !== null && s.fillOpacity > 0) out.push(f);
  out.push(blend(s.pattern, s.background, s.patternOpacity));
  if (f !== null) out.push(blend(s.pattern, f, s.patternOpacity));
  const a = s.accent ? blend(s.accent, s.background, s.accentOpacity ?? 1) : null;
  if (a !== null) out.push(a, blend(s.pattern, a, s.patternOpacity));
  return out;
}

export function worstTextContrastSurfaces(text: string, s: Surfaces): number {
  return Math.min(...surfaceColors(s).map((c) => contrastRatio(text, c)));
}

// A plate of opacity p over a layer at opacity o shows the layer at o * (1 - p).
export function plateSurfaces(s: Surfaces, plate: number): Surfaces {
  const k = 1 - Math.min(1, Math.max(0, plate));
  const accent = s.accent ? { accentOpacity: (s.accentOpacity ?? 1) * k } : {};
  return { ...s, patternOpacity: s.patternOpacity * k, fillOpacity: s.fillOpacity * k, ...accent };
}

export function fillVisible(s: Surfaces): number {
  const f = fillSurface(s);
  return f === null ? 1 : contrastRatio(f, s.background);
}
