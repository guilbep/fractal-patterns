// Line tracing for the studio's custom motif: an image to one stroked path with the main app's edge detectors, as
// polylines or smooth curves, then cropped to its subject and ready for ComposeOptions.custom.
import { safePathData } from '../motifgrid.ts';
import { pathData } from '../scene.ts';
import { traceCurves } from '../smoothtrace.ts';
import { edges, toGray, type Detector } from '../trace.ts';
import { vectorize } from '../vectorize.ts';
import { cropToSubject, type Rgba } from './colortrace.ts';
import type { CustomShape } from './compose.ts';

export interface LineTraceOptions {
  readonly detector: Detector;
  readonly threshold: number;
  /** Simplification tolerance in box units (curves: at least 0.6). */
  readonly detail: number;
  readonly minLength: number;
  readonly curves: boolean;
  readonly size: number;
}

export interface LineTrace {
  readonly d: string;
  readonly box: number;
  readonly lines: number;
  readonly bytes: number;
}

const result = (d: string, box: number): LineTrace => {
  const safe = safePathData(d) ?? '';
  return { d: safe, box, lines: (safe.match(/[Mm]/g) ?? []).length, bytes: safe.length };
};

export function traceLines(img: Rgba, o: LineTraceOptions): LineTrace {
  const g = toGray(img.data, img.width, img.height);
  const d = o.curves
    ? traceCurves(g, {
        detector: o.detector,
        threshold: o.threshold,
        size: o.size,
        minLength: o.minLength,
        smooth: 1.5,
        tolerance: Math.max(0.6, o.detail),
        refineSteps: 30,
        fit: 'contain',
      }).d(1)
    : pathData(
        vectorize(edges(g, o.detector, o.threshold), g.width, g.height, {
          tolerance: o.detail,
          minLength: o.minLength,
          size: o.size,
          fit: 'contain',
        }),
        1,
      );
  return result(d, o.size);
}

/** The line drawing scaled and moved so that its bounds fill the box less the margin (cropToSubject on one path). */
export function cropLines(r: LineTrace, margin = 0.04, anchor: 'center' | 'bottom' = 'center'): LineTrace {
  if (!r.d) return r;
  const c = cropToSubject({ shapes: [{ color: '#000000', d: r.d, area: 0 }], background: '#ffffff', box: r.box }, margin, anchor);
  return result(c.shapes[0]!.d, r.box);
}

/** The line drawing as a custom motif of one stroke shape (none for an empty drawing). */
export function lineMotif(r: LineTrace, color: string): { shapes: CustomShape[]; box: number } {
  return { shapes: r.d ? [{ color, d: r.d, paint: 'stroke', width: 1.5 }] : [], box: r.box };
}
