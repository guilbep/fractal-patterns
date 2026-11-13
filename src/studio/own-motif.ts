// The decisions behind the studio's "Your own motif" panel, as pure code: which method fits an image, the defaults of
// each method, the ink's own color, and the custom motif each method hands to compose.
import type { ColorShape } from './colortrace.ts';
import type { CustomShape } from './compose.ts';
import type { InkResult } from './inktrace.ts';
import type { LineTrace } from './linetrace.ts';
import type { SvgImport } from './svg-import.ts';

export type OwnMethod = 'color' | 'ink' | 'lines';

/** A custom shape that may ask for the even-odd rule (an ink trace with holes). */
export type OwnShape = CustomShape & { readonly evenodd?: boolean };

/** One-color line art (clear contrast, ink on under 35 % of the pixels) goes to Ink; anything else to Color shapes. */
export function pickMethod(i: { contrast: number; coverage: number; spread?: number }): OwnMethod {
  // Line art is one color: its ink pixels lie close to their mean color. A color picture on white also has high
  // contrast and little "ink", but its ink pixels differ from each other, so it goes to Color shapes.
  return i.contrast >= 0.35 && i.coverage < 0.35 && (i.spread ?? 0) < INK_SPREAD_MAX ? 'ink' : 'color';
}

export const INK_SPREAD_MAX = 0.16;

/** How far the ink pixels lie from their mean color: the root mean square RGB distance, from 0 to 1. */
export function inkSpread(pixels: ArrayLike<number>, mask: ArrayLike<number>): number {
  const sum = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    for (let c = 0; c < 3; c++) sum[c]! += pixels[4 * i + c]!;
    n++;
  }
  if (n === 0) return 0;
  const mean = sum.map((v) => v / n);
  let d = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    for (let c = 0; c < 3; c++) d += (pixels[4 * i + c]! - mean[c]!) ** 2;
  }
  return Math.sqrt(d / n / 3) / 255;
}

export function defaultsFor(method: OwnMethod): { scale: number; anchor: 'base' | 'center'; detail: number } {
  return method === 'ink'
    ? { scale: 1.6, anchor: 'center', detail: 0.3 }
    : { scale: 1, anchor: method === 'color' ? 'base' : 'center', detail: 0.6 };
}

/** The mean color of the pixels the mask marks (RGBA pixels), as #rrggbb; black when the mask is empty. */
export function inkColor(pixels: ArrayLike<number>, mask: ArrayLike<number>): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    r += pixels[4 * i]!;
    g += pixels[4 * i + 1]!;
    b += pixels[4 * i + 2]!;
    n++;
  }
  const hex = (v: number) =>
    Math.round(v / Math.max(1, n))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export const isSvgFile = (name: string, type: string): boolean => type === 'image/svg+xml' || /\.svg$/i.test(name);

/** The custom motif of each method, from its (cropped) result. */
export type OwnSource =
  | { readonly method: 'color'; readonly shapes: readonly ColorShape[]; readonly box: number }
  | { readonly method: 'ink'; readonly result: Pick<InkResult, 'd' | 'box'>; readonly color: string }
  | { readonly method: 'lines'; readonly result: Pick<LineTrace, 'd' | 'box'>; readonly color: string }
  | { readonly method: 'svg'; readonly result: Pick<SvgImport, 'shapes' | 'box'> };

export function ownShapes(s: OwnSource): { shapes: OwnShape[]; box: number } {
  switch (s.method) {
    case 'color':
      return { shapes: s.shapes.map((c) => ({ color: c.color, d: c.d })), box: s.box };
    case 'ink':
      return { shapes: s.result.d ? [{ color: s.color, d: s.result.d, paint: 'fill', evenodd: true }] : [], box: s.result.box };
    case 'lines':
      return { shapes: s.result.d ? [{ color: s.color, d: s.result.d, paint: 'stroke', width: 1.5 }] : [], box: s.result.box };
    case 'svg':
      return { shapes: s.result.shapes.map((c) => ({ color: c.color, d: c.d, paint: c.paint, width: c.width })), box: s.result.box };
  }
}
