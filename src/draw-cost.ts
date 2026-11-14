// Static and live cost model. The owner reviews this formula: see docs/review/draw-cost-formula.md.
//
// A design costs CO₂ once, when its bytes travel (co2.ts, from gzip bytes).
// A live layer (a live SVG filter, a blur behind the text plate, drift motion) also costs while it is visible,
// because the device redraws it.
//
// Model: the layer is redrawn R times per minute. Each redraw takes ms_per_redraw of work, measured on this device.
// Busy seconds per minute = R × ms_per_redraw / 1000.
// Energy per minute (J) = busy seconds × DRIFT_WATTS, the same assumed extra power draw as drift.
// kWh = J / 3 600 000. CO₂ (mg) = kWh × GRID_G_PER_KWH × 1000.
// Check: a layer busy all the time (R = 60, 1000 ms each) costs the same as drift, 4 mg per minute.

import { DRIFT_WATTS, GRID_G_PER_KWH } from './co2.ts';

// Assumption: a static live filter is repainted about once per second (scroll, resize, hover).
export const REDRAWS_PER_MINUTE = 60;
// Drift motion redraws every frame: 60 frames per second for 60 s.
export const DRIFT_REDRAWS_PER_MINUTE = 60 * 60;

export function liveMgPerMinute(
  msPerRedraw: number,
  redrawsPerMinute = REDRAWS_PER_MINUTE,
  watts = DRIFT_WATTS,
  grid = GRID_G_PER_KWH,
): number {
  const joules = ((redrawsPerMinute * msPerRedraw) / 1000) * watts;
  return (joules / 3.6e6) * grid * 1000;
}

// Below LOW_MAX_MS per redraw the level is low; from LOW_MAX_MS up it is high.
export const LOW_MAX_MS = 4;
export type CostLevel = 'none' | 'low' | 'high';

// null: no live layer.
export function costLevel(msPerRedraw: number | null): CostLevel {
  if (msPerRedraw === null) return 'none';
  return msPerRedraw < LOW_MAX_MS ? 'low' : 'high';
}

export interface CostInput {
  readonly onceBytes: number;
  readonly live: null | { readonly msPerRedraw: number; readonly redrawsPerMinute?: number };
}

export function costText({ onceBytes, live }: CostInput): { once: string; whileVisible: string } {
  const once = `Once: ${(onceBytes / 1024).toFixed(1)} kB`;
  if (live === null) return { once, whileVisible: 'While visible: none' };
  // 2 significant digits, trailing zeros dropped: 0.040 shows as 0.04.
  const mg = Number(liveMgPerMinute(live.msPerRedraw, live.redrawsPerMinute).toPrecision(2));
  return {
    once,
    whileVisible: `While visible: ${costLevel(live.msPerRedraw)}, ≈ ${mg} mg CO₂ per minute (estimate, measured on this device)`,
  };
}

// Browser only. Draws n times into a hidden canvas and returns the median ms per draw.
// Draws run in batches of up to 40 ms, with a frame between batches, so the page never blocks for more than 50 ms.
export async function measureRedrawMs(draw: (ctx: CanvasRenderingContext2D) => void, n = 20, w = 300, h = 300): Promise<number> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  const times: number[] = [];
  let batchStart = performance.now();
  for (let i = 0; i < n; i++) {
    if (performance.now() - batchStart > 40) {
      await new Promise((r) => requestAnimationFrame(r));
      batchStart = performance.now();
    }
    const t0 = performance.now();
    ctx.clearRect(0, 0, w, h);
    draw(ctx);
    ctx.getImageData(0, 0, 1, 1); // forces the draw to finish before the clock stops
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const m = times.length >> 1;
  return times.length % 2 ? times[m]! : (times[m - 1]! + times[m]!) / 2;
}

// Browser only. Loads the SVG (a live filter tile) once, then measures drawImage of it at w × h.
export async function measureSvgRedrawMs(svgText: string, w: number, h: number, n = 20): Promise<number> {
  const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  try {
    const img = new Image(w, h);
    img.src = url;
    await img.decode();
    return await measureRedrawMs((ctx) => ctx.drawImage(img, 0, 0, w, h), n, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}
