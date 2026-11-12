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

export function formatFootprint(gzipBytes: number): string {
  const mg = co2Mg(gzipBytes).toFixed(2);
  const kb = (gzipBytes / 1024).toFixed(2);
  return `≈ ${mg} mg CO₂ / visit · ${kb} KB compressed`;
}
