// Fills for closed shapes in a second color, and the text contrast over every surface they create.
// Pure: no DOM access.
import { blend, contrastRatio } from './contrast.ts';
import type { Pt } from './patterns/util.ts';
import { squareScene, type Scene } from './scene.ts';

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

// 'alternate' fills closed shapes 0, 2, 4, … in their order: a checker-like rhythm on regular grids.
export function fillScene(
  polys: readonly (readonly Pt[])[],
  o: { readonly size: number; readonly strokeWidth: number; readonly color: string; readonly opacity: number },
  fill: FillStyle,
): Scene {
  const stroke = squareScene(polys, o);
  if (fill.mode === 'none') return stroke;
  const { closed } = splitClosed(polys);
  const shapes = fill.mode === 'alternate' ? closed.filter((_, i) => i % 2 === 0) : closed;
  if (shapes.length === 0) return stroke;
  return {
    ...stroke,
    layers: [{ polys: shapes, paint: { mode: 'fill', color: fill.color, opacity: fill.opacity, width: 0 } }, ...stroke.layers],
  };
}

export interface Surfaces {
  readonly background: string;
  readonly pattern: string;
  readonly patternOpacity: number;
  readonly fill: string | null;
  readonly fillOpacity: number;
}

const fillSurface = (s: Surfaces): string | null => (s.fill === null ? null : blend(s.fill, s.background, s.fillOpacity));

// Every color that can lie under the text. Duplicates may stay.
export function surfaceColors(s: Surfaces): string[] {
  const out = [s.background];
  const f = fillSurface(s);
  if (f !== null && s.fillOpacity > 0) out.push(f);
  out.push(blend(s.pattern, s.background, s.patternOpacity));
  if (f !== null) out.push(blend(s.pattern, f, s.patternOpacity));
  return out;
}

export function worstTextContrastSurfaces(text: string, s: Surfaces): number {
  return Math.min(...surfaceColors(s).map((c) => contrastRatio(text, c)));
}

// A plate of opacity p over a layer at opacity o shows the layer at o * (1 - p).
export function plateSurfaces(s: Surfaces, plate: number): Surfaces {
  const k = 1 - Math.min(1, Math.max(0, plate));
  return { ...s, patternOpacity: s.patternOpacity * k, fillOpacity: s.fillOpacity * k };
}

export function fillVisible(s: Surfaces): number {
  const f = fillSurface(s);
  return f === null ? 1 : contrastRatio(f, s.background);
}
