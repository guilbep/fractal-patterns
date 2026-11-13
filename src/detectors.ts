// Edge detector ids and labels, apart from trace.ts so the page can name them without loading the tracing code.
import type { IsoOptions } from './isolines.ts';

export const DETECTORS = ['sobel', 'prewitt', 'roberts', 'laplacian', 'canny', 'scharr', 'xdog'] as const; // append only: ids are persisted
export type Detector = (typeof DETECTORS)[number];
// The Image tab's tracing choice: an edge detector, or contour lines of the brightness (isolines.ts).
export type TraceChoice = Detector | 'isolines';

export const DETECTOR_LABELS: Readonly<Record<TraceChoice, string>> = {
  sobel: 'Sobel',
  prewitt: 'Prewitt',
  roberts: 'Roberts cross',
  laplacian: 'Laplacian',
  canny: 'Canny',
  scharr: 'Scharr',
  xdog: 'XDoG (ink lines)',
  isolines: 'Contour lines (brightness levels)',
};

export const TRACE_GROUPS: readonly { readonly label: string; readonly ids: readonly TraceChoice[] }[] = [
  { label: 'Edges', ids: DETECTORS },
  { label: 'Contours', ids: ['isolines'] },
];

/** The words after "traced from …," in a caption: "Canny edges" or "contour lines". */
export const traceName = (d: TraceChoice): string => (d === 'isolines' ? 'contour lines' : `${DETECTOR_LABELS[d]} edges`);

export interface TraceSettings {
  readonly detector: TraceChoice;
  readonly threshold: number;
  readonly levels: number;
  readonly tolerance: number;
  readonly minLength: number;
}
export type TraceCall =
  | { readonly method: 'isolines'; readonly options: IsoOptions }
  | { readonly method: 'edges'; readonly detector: Detector; readonly threshold: number };

/** Which tracer runs for these settings, with its arguments. Pure, so the choice is testable without the tracing code. */
export function traceCall(o: TraceSettings, size: number): TraceCall {
  // ponytail: blur 1 and strength 0.7 are the isolines test values, no control; add sliders when a ticket asks.
  if (o.detector === 'isolines')
    return {
      method: 'isolines',
      options: { levels: o.levels, blur: 1, strength: 0.7, minLength: o.minLength, tolerance: o.tolerance, size },
    };
  return { method: 'edges', detector: o.detector, threshold: o.threshold };
}
