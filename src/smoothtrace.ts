// Image to smooth cubic Bézier chains in tile coordinates: edge map, raw pixel chains, Gaussian smoothing,
// least squares fit, then refinement on the blurred edge strength. Pure: no DOM, no randomness.
import { curvePathData, fitCurves, refine, sampleField, smoothChain, type Cubic, type Field } from './curvefit.ts';
import type { Pt } from './patterns/util.ts';
import { edges, gaussianBlur, gradient, type Detector, type Gray } from './trace.ts';
import { tileScale, vectorize } from './vectorize.ts';

export interface CurveTraceOptions {
  readonly detector: Detector;
  readonly threshold: number;
  readonly size: number;
  readonly minLength: number;
  readonly smooth: number;
  readonly tolerance: number;
  readonly refineSteps: number;
}

const RATE = 1;
const SMOOTH = 0.001;

// Sobel magnitude, blurred (sigma 1.5 px), scaled to a maximum of 1 and resampled to tile coordinates.
function edgeField(g: Gray, size: number): Field {
  const blurred = gaussianBlur({ data: gradient(g, 'sobel'), width: g.width, height: g.height }, 1.5);
  let max = 0;
  for (const v of blurred.data) if (v > max) max = v;
  const img: Field = { width: g.width, height: g.height, data: blurred.data };
  const { s, ox, oy } = tileScale(g.width, g.height, size);
  const data = new Float32Array(size * size);
  // Tile point t is image point (t - offset) / s; pixel centers sit at index + 0.5.
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = max > 0 ? sampleField(img, (x - ox) / s - 0.5, (y - oy) / s - 0.5) / max : 0;
  return { width: size, height: size, data };
}

export function traceCurves(g: Gray, o: CurveTraceOptions): { chains: Cubic[][]; d(precision: number): string } {
  const map = edges(g, o.detector, o.threshold);
  const { s } = tileScale(g.width, g.height, o.size);
  const field = o.refineSteps > 0 ? edgeField(g, o.size) : null;
  const chains = vectorize(map, g.width, g.height, { size: o.size, tolerance: 0, minLength: o.minLength }).map((raw) => {
    // A walk around a loop ends next to its start: close it.
    const a = raw[0]!;
    const b = raw[raw.length - 1]!;
    const loop: Pt[] = raw.length >= 8 && Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1.5 * s ? [...raw, a] : raw;
    const fitted = fitCurves(smoothChain(loop, o.smooth), o.tolerance);
    return field ? refine(fitted, field, { steps: o.refineSteps, rate: RATE, smooth: SMOOTH }) : fitted;
  });
  return { chains, d: (precision) => curvePathData(chains, precision) };
}
