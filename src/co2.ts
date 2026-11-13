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

// The compressed size in KB with three significant digits: 0.312, 1.94, 12.6, 104.
export function formatKb(gzipBytes: number): string {
  const kb = gzipBytes / 1024;
  return kb >= 1000 ? String(Math.round(kb)) : kb.toPrecision(3);
}

export function formatFootprint(gzipBytes: number): string {
  const mg = mgText(co2Mg(gzipBytes));
  const kb = (gzipBytes / 1024).toFixed(2);
  return `≈ ${mg} mg CO₂ / visit · ${kb} KB compressed`;
}

// The size breakdown under the size badge and in the Export tab. gz: null while computing, 'unknown' when gzip failed.
export interface SizeInput {
  readonly css: number;
  readonly svg: number;
  readonly script: number; // 0 when the export has no script
  readonly gz: { readonly css: number; readonly script: number } | null | 'unknown';
}
export function sizeLines(s: SizeInput): string[] {
  const gz = (pick: (g: { css: number; script: number }) => number) =>
    s.gz === null ? 'computing' : s.gz === 'unknown' ? 'size unknown' : `${formatKb(pick(s.gz))} KB compressed`;
  const lines = [`CSS: ${formatKb(s.css)} KB, ${gz((g) => g.css)}`, `SVG tile, as a file: ${formatKb(s.svg)} KB`];
  if (s.script > 0) lines.push(`Script: ${formatKb(s.script)} KB, ${gz((g) => g.script)}`);
  return lines;
}

// Weight grade: the tool's own scale for the compressed export size. Not the Website Carbon rating
// (A+ to F, grams of CO2 per whole page visit). Each grade holds below its limit; E has no limit.
export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E';
export const WEIGHT_GRADES: readonly { readonly grade: Grade; readonly limitKb: number | null }[] = [
  { grade: 'A+', limitKb: 1 },
  { grade: 'A', limitKb: 2 },
  { grade: 'B', limitKb: 5 },
  { grade: 'C', limitKb: 10 },
  { grade: 'D', limitKb: 20 },
  { grade: 'E', limitKb: null },
];
export function weightGrade(gzipBytes: number): { grade: Grade; limitKb: number | null } {
  const g = WEIGHT_GRADES.find((w) => w.limitKb !== null && gzipBytes < w.limitKb * 1024);
  return g ? { ...g } : { grade: 'E', limitKb: null };
}
// 'good' | 'mid' | 'high': the chip color band. The letter is the signal; the color only repeats it.
export function gradeBand(grade: Grade): 'good' | 'mid' | 'high' {
  return grade === 'A+' || grade === 'A' ? 'good' : grade === 'B' || grade === 'C' ? 'mid' : 'high';
}
export function gradeLine(gzipBytes: number): string {
  const { grade, limitKb } = weightGrade(gzipBytes);
  return limitKb === null
    ? `Weight grade ${grade}: ${WEIGHT_GRADES.at(-2)?.limitKb} KB compressed or more.`
    : `Weight grade ${grade}: under ${limitKb} KB compressed.`;
}
export const GRADE_SCALE = `This is the tool's own scale: ${WEIGHT_GRADES.map((w, i) =>
  w.limitKb === null ? `${w.grade} above` : `${w.grade} under ${w.limitKb}${i === 0 ? ' KB' : ''}`,
).join(', ')}. It is not the Website Carbon rating, which rates a whole page.`;
