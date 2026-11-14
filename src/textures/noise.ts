// Periodic noise for an n x n texture tile (n a power of two). Every lattice period divides n, so the tile wraps.
// Pure: runs in node and in a Web Worker.

import { mulberry32 } from '../patterns/util.ts';

export interface NoiseOptions {
  // Lattice cells across the tile for the first octave, rounded to a power of two in [1, n].
  scale: number;
  octaves?: number;
}

const pow2 = (v: number, n: number) => Math.min(n, 2 ** Math.max(0, Math.round(Math.log2(Math.max(1, v)))));
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Gradient (Perlin-style) noise, measured ~3x faster than FFT-filtered white noise at 256^2.
// octave k has scale * 2^k cells, amplitude 2^-k. Values roughly -1..1.
export function periodicNoise(n: number, seed: number, o: NoiseOptions): Float32Array {
  const rnd = mulberry32(seed);
  const out = new Float32Array(n * n);
  let c = pow2(o.scale, n);
  let amp = 1;
  let total = 0;
  for (let k = 0; k < (o.octaves ?? 1) && c <= n; k++, c *= 2, amp /= 2) {
    const gx = new Float32Array(c * c);
    const gy = new Float32Array(c * c);
    for (let i = 0; i < c * c; i++) {
      const a = rnd() * 2 * Math.PI;
      gx[i] = Math.cos(a);
      gy[i] = Math.sin(a);
    }
    const s = n / c;
    for (let y = 0; y < n; y++) {
      const fy = y / s;
      const j0 = Math.floor(fy);
      const v = fy - j0;
      const r0 = j0 * c;
      const r1 = ((j0 + 1) % c) * c;
      const fv = fade(v);
      for (let x = 0; x < n; x++) {
        const fx = x / s;
        const i0 = Math.floor(fx);
        const u = fx - i0;
        const i1 = (i0 + 1) % c;
        const d00 = gx[r0 + i0]! * u + gy[r0 + i0]! * v;
        const d10 = gx[r0 + i1]! * (u - 1) + gy[r0 + i1]! * v;
        const d01 = gx[r1 + i0]! * u + gy[r1 + i0]! * (v - 1);
        const d11 = gx[r1 + i1]! * (u - 1) + gy[r1 + i1]! * (v - 1);
        const fu = fade(u);
        const a = d00 + (d10 - d00) * fu;
        const b = d01 + (d11 - d01) * fu;
        // sqrt(2) brings the gradient noise range (about +-0.7) to about +-1.
        out[y * n + x]! += amp * Math.SQRT2 * (a + (b - a) * fv);
      }
    }
    total += amp;
  }
  if (total > 0) for (let i = 0; i < out.length; i++) out[i]! /= total;
  return out;
}

// Lambert shading of a height field, periodic central differences. Returns 0..1.
export function emboss(height: Float32Array, n: number, light: readonly number[] = [-1, -1, 1]): Float32Array {
  const ll = Math.hypot(light[0]!, light[1]!, light[2]!);
  const [lx, ly, lz] = [light[0]! / ll, light[1]! / ll, light[2]! / ll];
  const out = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    const up = ((y + n - 1) % n) * n;
    const dn = ((y + 1) % n) * n;
    for (let x = 0; x < n; x++) {
      const dx = (height[y * n + ((x + 1) % n)]! - height[y * n + ((x + n - 1) % n)]!) / 2;
      const dy = (height[dn + x]! - height[up + x]!) / 2;
      const len = Math.hypot(dx, dy, 1);
      out[y * n + x] = Math.max(0, (-dx * lx - dy * ly + lz) / len);
    }
  }
  return out;
}
