// CO2-per-visit estimate for the generated SVG tile, from its gzipped size.
// Same linear model as pierreguilbert.com/scripts/inject-co2.mjs: one
// websitecarbon.com calibration point for that site (5.76 KB -> 0.001144 g CO2).
// Web-standard globals only, so it runs in the browser and in Node.

export const G_PER_BYTE = 0.001144116732462 / (5.76 * 1024); // ≈ 1.94e-7

export function co2Mg(bytes: number): number {
  return bytes * G_PER_BYTE * 1000;
}

export function rawSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

export async function gzipSize(text: string): Promise<number> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return (await new Response(stream).arrayBuffer()).byteLength;
}

// Assumed extra power draw while a layer repaints every frame. Not a measurement:
// a plausible range is 0.1 W on a phone to 2 W on a large laptop screen.
// Replace it when a measured value exists.
export const DRIFT_WATTS = 0.5;

// Rough world average grid carbon intensity. Real grids differ several times in both directions.
export const GRID_G_PER_KWH = 480;

// CO2 in mg for one minute of drift: kWh for 60 s times g per kWh, times 1000.
export function driftMgPerMinute(watts = DRIFT_WATTS, grid = GRID_G_PER_KWH): number {
  return ((watts * 60) / 3600 / 1000) * grid * 1000;
}

// How many times the tile's transfer footprint `minutes` of drift costs. 0 when tileMg is 0 or not finite.
export function driftMultiple(tileMg: number, minutes = 1, watts = DRIFT_WATTS, grid = GRID_G_PER_KWH): number {
  if (tileMg === 0 || !Number.isFinite(tileMg)) return 0;
  return (driftMgPerMinute(watts, grid) * minutes) / tileMg;
}

// 1 decimal from 1 mg up, 1 significant digit below. Scales by multiplying (0.15 * 10 is 1.5 exactly),
// so 0.15 rounds to 0.2 where toPrecision(1) would give 0.1.
function mgText(mg: number): string {
  if (mg >= 1) return mg.toFixed(1);
  if (mg <= 0) return '0';
  const k = -Math.floor(Math.log10(mg));
  return (Math.round(mg * 10 ** k) / 10 ** k).toFixed(k);
}

export function formatFootprint(gzipBytes: number): string {
  const mg = mgText(co2Mg(gzipBytes));
  const kb = (gzipBytes / 1024).toFixed(2);
  return `≈ ${mg} mg CO₂ / visit · ${kb} KB compressed`;
}
