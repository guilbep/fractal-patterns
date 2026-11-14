// Surface textures as RGBA pixels: the background color pushed toward black (dark) or white (light) by a periodic
// field t in 0..1. Every field is built from periodic noise or per-pixel white noise, so the tile wraps.
// Pure: runs in node and in a Web Worker.

import { mulberry32 } from '../patterns/util.ts';
import { emboss, periodicNoise } from './noise.ts';

export type SurfaceKind = 'paper' | 'coldpress' | 'linen' | 'plaster' | 'sand' | 'riso';
export interface SurfaceOptions {
  n?: number;
  seed: number;
  scale: number; // 0.5..2, feature size
  strength: number; // 0..100
  tone: 'dark' | 'light';
  background: string; // #rrggbb
}

type Rgb = [number, number, number];
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const FLAT = 1 / Math.sqrt(3); // emboss of a flat surface under the default light

function scaled(h: Float32Array, k: number): Float32Array {
  return h.map((v) => v * k);
}

function normalize(h: Float32Array): Float32Array {
  let m = 0;
  for (const v of h) m = Math.max(m, Math.abs(v));
  return m > 0 ? scaled(h, 1 / m) : h;
}

// Periodic box blur along one axis: smears noise into threads.
function streak(h: Float32Array, n: number, r: number, alongX: boolean): Float32Array {
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) s += alongX ? h[y * n + ((x + d + n) % n)]! : h[((y + d + n) % n) * n + x]!;
      out[y * n + x] = s / (2 * r + 1);
    }
  return out;
}

// Field t (0..1) and the strongest pull toward black/white the kind should reach at strength 100.
function field(kind: SurfaceKind, n: number, seed: number, scale: number): [Float32Array, number] {
  const noise = (cells: number, octaves: number, s = seed) => periodicNoise(n, s, { scale: cells / scale, octaves });
  const white = mulberry32(seed ^ 0x5bd1e995);
  switch (kind) {
    case 'paper': {
      const h = noise(32, 3);
      const e = emboss(scaled(h, 3), n);
      return [h.map((v, i) => clamp01(0.3 + 0.3 * v + 2 * (FLAT - e[i]!))), 0.12];
    }
    case 'coldpress': {
      const h = noise(8, 3);
      const e = emboss(scaled(h, 12), n);
      return [h.map((v, i) => clamp01(0.3 + 0.2 * v + 2 * (FLAT - e[i]!))), 0.22];
    }
    case 'linen': {
      // Fine noise smeared along x crossed with another smeared along y: the two thread directions.
      const r = Math.max(2, Math.round(5 * scale));
      const a = normalize(streak(noise(64, 1), n, r, true));
      const b = normalize(streak(noise(64, 1, seed + 1), n, r, false));
      return [a.map((v, i) => clamp01(0.5 + 0.35 * (v + b[i]!))), 0.16];
    }
    case 'plaster': {
      const lo = noise(4, 2);
      const fine = noise(64, 1, seed + 1);
      return [lo.map((v, i) => clamp01(0.35 + 0.45 * v + (fine[i]! > 0.4 ? 0.5 : 0))), 0.18];
    }
    case 'sand': {
      const f = noise(128, 1);
      return [f.map((v) => clamp01(0.5 * white() + 0.25 + 0.4 * v)), 0.22];
    }
    case 'riso': {
      // Hard dots, denser where a low-frequency field is high: a halftone-like grain.
      const d = noise(16, 2);
      return [d.map((v) => (white() < 0.3 * (0.5 + 0.5 * v) ? 1 : 0)), 0.35];
    }
  }
}

function parseHex(hex: string): Rgb {
  const v = Number.parseInt(hex.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function surfacePixels(kind: SurfaceKind, o: SurfaceOptions): Uint8ClampedArray {
  const n = o.n ?? 256;
  const bg = parseHex(o.background);
  const px = new Uint8ClampedArray(n * n * 4);
  const [t, max] = field(kind, n, o.seed, o.scale);
  const k = (max * Math.min(100, Math.max(0, o.strength))) / 100;
  const target = o.tone === 'dark' ? 0 : 255;
  for (let i = 0; i < n * n; i++) {
    const a = t[i]! * k;
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round(bg[c]! + (target - bg[c]!) * a);
    px[i * 4 + 3] = 255;
  }
  return px;
}

const lum = (p: Uint8ClampedArray, i: number) => 0.2126 * p[i]! + 0.7152 * p[i + 1]! + 0.0722 * p[i + 2]!;

export function surfaceRange(px: Uint8ClampedArray): { darkest: Rgb; lightest: Rgb } {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (lum(px, i) < lum(px, lo)) lo = i;
    if (lum(px, i) > lum(px, hi)) hi = i;
  }
  return { darkest: [px[lo]!, px[lo + 1]!, px[lo + 2]!], lightest: [px[hi]!, px[hi + 1]!, px[hi + 2]!] };
}
