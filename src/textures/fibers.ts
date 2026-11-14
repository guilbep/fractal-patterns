// Washi and kraft fiber textures as RGBA pixels. Pure: runs in node and in a Web Worker.
// Fibers are smooth random walks drawn wrapped on a 2n canvas, then box-downsampled to n.
import { mulberry32 } from '../patterns/util.ts';

export type FiberKind = 'washi' | 'kraft';
export type FiberOptions = {
  n?: number;
  seed: number;
  scale: number;
  strength: number;
  background: string;
  colors: readonly string[];
  // Test hook: these polylines (output px) replace the random fibers.
  paths?: readonly (readonly (readonly [number, number])[])[];
};
type Rgb = [number, number, number];

const rgb = (hex: string): Rgb => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const KINDS = {
  // count at n = 256, length as a share of n, half width in canvas px, walk turn per step, opacity
  washi: { count: 420, length: 0.5, half: 0.6, turn: 0.18, alpha: 0.28 },
  kraft: { count: 900, length: 0.12, half: 0.9, turn: 0.4, alpha: 0.55 },
} as const;

export function fiberPixels(kind: FiberKind, o: FiberOptions): Uint8ClampedArray {
  const n = o.n ?? 256;
  const N = 2 * n;
  const s = Math.max(0, Math.min(100, o.strength)) / 100;
  const k = KINDS[kind];
  const rnd = mulberry32(o.seed);
  const bg = rgb(o.background);
  const fiberColor =
    kind === 'washi'
      ? mix(bg, [255, 255, 255], 0.7)
      : mix(mix(bg, [bg[0] * 0.6, bg[1] * 0.52, bg[2] * 0.42], 0.8), o.colors[1] ? rgb(o.colors[1]) : bg, 0.2);

  const img = new Float32Array(N * N * 3);
  for (let i = 0; i < N * N; i++) img.set(bg, i * 3);
  // Per-fiber max coverage, so a stroke's overlapping segments do not darken its joints.
  const cov = new Float32Array(N * N);
  const touched: number[] = [];

  const segment = (x0: number, y0: number, x1: number, y1: number, half: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    const r = half + 1;
    const ix0 = Math.floor(Math.min(x0, x1) - r);
    const ix1 = Math.ceil(Math.max(x0, x1) + r);
    const iy0 = Math.floor(Math.min(y0, y1) - r);
    const iy1 = Math.ceil(Math.max(y0, y1) + r);
    for (let iy = iy0; iy <= iy1; iy++) {
      // Modulo wrap = the segment drawn at every ±N offset.
      const row = (((iy % N) + N) % N) * N;
      for (let ix = ix0; ix <= ix1; ix++) {
        const px = ix + 0.5 - x0;
        const py = iy + 0.5 - y0;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const ex = px - t * dx;
        const ey = py - t * dy;
        const c = Math.min(1, half + 0.5 - Math.sqrt(ex * ex + ey * ey));
        if (c <= 0) continue;
        const idx = row + (((ix % N) + N) % N);
        if (cov[idx] === 0) touched.push(idx);
        if (c > cov[idx]!) cov[idx] = c;
      }
    }
  };
  const blend = (color: Rgb, alpha: number) => {
    for (const idx of touched) {
      const a = cov[idx]! * alpha;
      for (let c = 0; c < 3; c++) img[idx * 3 + c]! += (color[c]! - img[idx * 3 + c]!) * a;
      cov[idx] = 0;
    }
    touched.length = 0;
  };

  if (o.paths) {
    for (const path of o.paths) {
      for (let i = 1; i < path.length; i++) {
        const [x0, y0] = path[i - 1]!;
        const [x1, y1] = path[i]!;
        segment(x0 * 2, y0 * 2, x1 * 2, y1 * 2, k.half * o.scale);
      }
      blend(fiberColor, k.alpha);
    }
  } else {
    const count = Math.round(k.count * s * (n / 256) ** 2);
    const step = 2;
    for (let f = 0; f < count; f++) {
      let x = rnd() * N;
      let y = rnd() * N;
      let a = rnd() * 2 * Math.PI;
      let turn = 0;
      const steps = Math.max(2, Math.round((k.length * N * o.scale * (0.5 + rnd())) / step));
      const half = k.half * o.scale * (0.7 + 0.6 * rnd());
      for (let i = 0; i < steps; i++) {
        // Turn rate drifts slowly, so the direction bends smoothly.
        turn = turn * 0.9 + (rnd() - 0.5) * k.turn;
        a += turn * 0.3;
        const nx = x + Math.cos(a) * step;
        const ny = y + Math.sin(a) * step;
        segment(x, y, nx, ny, half);
        x = nx;
        y = ny;
      }
      blend(fiberColor, k.alpha * s * (0.5 + 0.5 * rnd()));
    }
  }

  // Washi base: faint mottling from waves with whole periods per tile, so it wraps.
  const waves: [number, number, number, number][] = [];
  if (kind === 'washi' && s > 0)
    for (let w = 0; w < 4; w++)
      waves.push([1 + Math.floor(rnd() * 4), Math.floor(rnd() * 5) - 2, rnd() * 2 * Math.PI, 0.012 * s * (0.5 + rnd())]);

  const out = new Uint8ClampedArray(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let m = 1;
      for (const [fx, fy, ph, amp] of waves) m += amp * Math.sin((2 * Math.PI * (fx * i + fy * j)) / n + ph);
      const a = (2 * j * N + 2 * i) * 3;
      const b = a + N * 3;
      const q = (j * n + i) * 4;
      for (let c = 0; c < 3; c++) out[q + c] = ((img[a + c]! + img[a + 3 + c]! + img[b + c]! + img[b + 3 + c]!) / 4) * m;
      out[q + 3] = 255;
    }
  return out;
}
