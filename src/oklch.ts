import { parseHex, toHex } from './contrast.ts';

// OKLab matrices from Björn Ottosson, https://bottosson.github.io/posts/oklab/

const encode = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const decode = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPS = 1e-6;
const CHROMA_STEP = 0.002;

export function oklchToHex(l: number, c: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  // Out of the sRGB gamut: reduce the chroma in small steps until every channel fits.
  for (let k = c; ; k = Math.max(0, k - CHROMA_STEP)) {
    const rgb = oklabToLinear(l, k * Math.cos(h), k * Math.sin(h));
    if (k === 0 || rgb.every((v) => v >= -EPS && v <= 1 + EPS)) {
      return toHex(rgb.map((v) => encode(Math.min(1, Math.max(0, v))) * 255) as [number, number, number]);
    }
  }
}

export function hexToOklch(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex).map((v) => decode(v / 255)) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, Math.hypot(A, B), h < 0 ? h + 360 : h];
}
