import { blend, parseHex, relativeLuminance, toHex } from './contrast.ts';
import { PATTERN_VISIBLE_MIN, patternContrast, worstTextContrast, type Roles } from './pairing.ts';

// True when the text is darker than one surface and lighter than the other:
// strokes then cross the letters with reversed polarity, which the ratio alone does not show.
export function betweenSurfaces(r: Roles, opacity: number): boolean {
  if (patternContrast(r, opacity) < PATTERN_VISIBLE_MIN) return false;
  const t = relativeLuminance(r.text);
  const a = relativeLuminance(r.background);
  const b = relativeLuminance(blend(r.pattern, r.background, opacity));
  return Math.min(a, b) < t && t < Math.max(a, b);
}

export const CVD_TYPES = ['protan', 'deutan', 'tritan'] as const;
export type CvdType = (typeof CVD_TYPES)[number];

export const CVD_LABELS: Readonly<Record<CvdType, string>> = {
  protan: 'Red-weak (protan)',
  deutan: 'Green-weak (deutan)',
  tritan: 'Blue-weak (tritan)',
};

type Matrix = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];

// Severity 1.0 matrices from Machado, Oliveira and Fernandes (2009), "A Physiologically-based
// Model for Simulation of Color Vision Deficiency", IEEE TVCG 15(6), as published on the authors' page.
// Rows give the new R, G, B. Working assumption: the paper applies them to linear RGB
// (a secondary source, the R colorspace package manual, says so).
export const CVD_MATRICES: Readonly<Record<CvdType, Matrix>> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number): number => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function simulate(hex: string, type: CvdType): string {
  const lin = parseHex(hex).map((c) => toLinear(c / 255));
  const out = CVD_MATRICES[type].map((row) => {
    const v = Math.min(1, Math.max(0, row[0] * lin[0]! + row[1] * lin[1]! + row[2] * lin[2]!));
    return toGamma(v) * 255;
  });
  return toHex([out[0]!, out[1]!, out[2]!]);
}

export function simulateRoles(r: Roles, type: CvdType): Roles {
  return { background: simulate(r.background, type), pattern: simulate(r.pattern, type), text: simulate(r.text, type) };
}

export interface CvdResult {
  readonly type: CvdType;
  readonly roles: Roles;
  readonly text: number;
  readonly pattern: number;
}

export function cvdReport(r: Roles, opacity: number): CvdResult[] {
  return CVD_TYPES.map((type) => {
    const roles = simulateRoles(r, type);
    return { type, roles, text: worstTextContrast(roles, opacity), pattern: patternContrast(roles, opacity) };
  });
}

export function cvdWorstText(r: Roles, opacity: number): number {
  return Math.min(...cvdReport(r, opacity).map((c) => c.text));
}

// CIE L* (0 to 100) from the WCAG relative luminance Y.
export function lstar(hex: string): number {
  const y = relativeLuminance(hex);
  const d = 6 / 29;
  const f = y > d ** 3 ? Math.cbrt(y) : y / (3 * d * d) + 4 / 29;
  return 116 * f - 16;
}

export interface LightnessDiff {
  readonly value: number;
  readonly polarity: 'dark-on-light' | 'light-on-dark' | 'same';
}

export function lightnessDiff(text: string, surface: string): LightnessDiff {
  const d = lstar(surface) - lstar(text);
  const value = Math.abs(d);
  return { value, polarity: value < 0.5 ? 'same' : d > 0 ? 'dark-on-light' : 'light-on-dark' };
}

// The pattern opacity as seen through a text plate, the same rule as plateContrast.
export function effectiveOpacity(opacity: number, plate: number): number {
  return opacity * (1 - Math.min(1, Math.max(0, plate)));
}
