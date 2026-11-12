// Built-in example pictures for the image tracer, drawn in memory. No image file ships with the app.
// Every picture is toroidal (coordinates modulo the size), so it repeats without a seam.
import { mulberry32, TAU, type Rng } from './patterns/util.ts';

export const SAMPLES = ['bricks', 'stones', 'tiles', 'grass'] as const;
export type Sample = (typeof SAMPLES)[number];

export const SAMPLE_LABELS: Readonly<Record<Sample, string>> = {
  bricks: 'Brick wall',
  stones: 'Rounded stones',
  tiles: 'Roof tiles',
  grass: 'Grass tufts',
};

const SEEDS: Readonly<Record<Sample, number>> = { bricks: 11, stones: 23, tiles: 37, grass: 41 };

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Signed wrap of a difference into [-n/2, n/2).
function wrap(d: number, n: number): number {
  return d - n * Math.round(d / n);
}

// Ink coverage 0..1 for a line of half-width w at distance d, anti-aliased over about 1.5 px.
function inkAt(d: number, w: number): number {
  return 1 - smoothstep(w - 0.75, w + 0.75, d);
}

// Raster helper: max-blends an anti-aliased segment into `ink`, wrapping around the edges.
function segment(ink: Float32Array, n: number, ax: number, ay: number, bx: number, by: number, w: number): void {
  const pad = w + 2;
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  for (let y = Math.floor(Math.min(ay, by) - pad); y <= Math.ceil(Math.max(ay, by) + pad); y++) {
    for (let x = Math.floor(Math.min(ax, bx) - pad); x <= Math.ceil(Math.max(ax, bx) + pad); x++) {
      const t = Math.min(1, Math.max(0, ((x - ax) * vx + (y - ay) * vy) / len2));
      const d = Math.hypot(x - ax - t * vx, y - ay - t * vy);
      const i = (((y % n) + n) % n) * n + (((x % n) + n) % n);
      ink[i] = Math.max(ink[i]!, inkAt(d, w));
    }
  }
}

function bricks(n: number, rnd: Rng): { ink: Float32Array; shade: Float32Array } {
  const ink = new Float32Array(n * n);
  const shade = new Float32Array(n * n);
  const courses = 4;
  const per = 2;
  const ch = n / courses;
  const bw = n / per;
  const w = (0.03 * n) / 2;
  const rows = Array.from({ length: courses }, (_, c) => c * ch + (rnd() - 0.5) * 0.08 * ch);
  for (let c = 0; c < courses; c++) {
    const y0 = rows[c]!;
    const y1 = c + 1 < courses ? rows[c + 1]! : rows[0]! + n;
    segment(ink, n, -w, y0, n + w, y0, w);
    for (let i = 0; i < per; i++) {
      const x = (i + (c % 2) * 0.5) * bw + (rnd() - 0.5) * 0.1 * bw;
      segment(ink, n, x, y0, x, y1, w);
      // A short thin crack inside some bricks.
      if (rnd() < 0.6) {
        let px = x + bw * (0.25 + rnd() * 0.5);
        let py = y0 + ch * (0.3 + rnd() * 0.4);
        for (let k = 0; k < 3; k++) {
          const a = rnd() * TAU;
          const qx = px + Math.cos(a) * ch * 0.18;
          const qy = py + Math.sin(a) * ch * 0.18;
          segment(ink, n, px, py, qx, qy, 0.5);
          px = qx;
          py = qy;
        }
      }
    }
  }
  // Each brick a little lighter in its middle: soft shading from the distance to the joints.
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) shade[y * n + x] = 6 * Math.sin((TAU * y * courses) / n - Math.PI / 2);
  return { ink, shade };
}

function stones(n: number, rnd: Rng): { ink: Float32Array; shade: Float32Array } {
  const ink = new Float32Array(n * n);
  const shade = new Float32Array(n * n);
  const g = 4; // cells per edge
  const cell = n / g;
  const pts = Array.from(
    { length: g * g },
    (_, k) => [((k % g) + 0.2 + rnd() * 0.6) * cell, (Math.floor(k / g) + 0.2 + rnd() * 0.6) * cell] as const,
  );
  const gap = 0.006 * n;
  const r = 0.04 * n; // corner radius
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let d1 = Infinity;
      let d2 = Infinity;
      let d3 = Infinity;
      for (const [px, py] of pts) {
        const d = Math.hypot(wrap(x - px, n), wrap(y - py, n));
        if (d < d1) [d1, d2, d3] = [d, d1, d2];
        else if (d < d2) [d2, d3] = [d, d2];
        else if (d < d3) d3 = d;
      }
      // Distances to the two nearest cell walls, then a rounded corner where they meet.
      const a = (d2 - d1) / 2 - gap;
      const b = (d3 - d1) / 2 - gap;
      const q = a > r || b > r ? Math.min(a, b) : r - Math.hypot(Math.max(r - a, 0), Math.max(r - b, 0));
      ink[y * n + x] = 1 - smoothstep(-0.75, 0.75, q);
      shade[y * n + x] = -24 * Math.exp(-Math.max(q, 0) / (0.03 * n)); // darker toward the rim: a rounded look
    }
  }
  return { ink, shade };
}

function tiles(n: number): { ink: Float32Array; shade: Float32Array } {
  const ink = new Float32Array(n * n);
  const shade = new Float32Array(n * n);
  const cols = 4;
  const rowsN = 8;
  const tw = n / cols;
  const rh = n / rowsN;
  const R = tw / 2;
  const lw = 0.012 * n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k0 = Math.floor(y / rh);
      // The highest tile that covers the pixel lies on top: its lower edge overlaps the row below.
      for (let k = k0 - 1; k <= k0 + 3; k++) {
        const cy = k * rh;
        const off = (((k % 2) + 2) % 2) * 0.5;
        const dx = wrap(x - off * tw, tw);
        const dy = y - cy;
        let d: number; // distance inside the tile to its lower edge
        if (dy > 0) d = R - Math.hypot(dx, dy);
        else if (dy > -2 * rh) d = R - Math.abs(dx);
        else continue;
        if (d < -0.75) continue;
        ink[y * n + x] = inkAt(Math.max(d, 0), lw);
        shade[y * n + x] = -30 * Math.exp(-Math.max(d, 0) / (0.06 * n)) - 10 * smoothstep(0, R, -dy);
        break;
      }
    }
  }
  return { ink, shade };
}

function grass(n: number, rnd: Rng): { ink: Float32Array; shade: Float32Array } {
  const ink = new Float32Array(n * n);
  const shade = new Float32Array(n * n);
  const g = 4;
  const cell = n / g;
  for (let j = 0; j < g; j++) {
    for (let i = 0; i < g; i++) {
      const bx = (i + 0.5 + (j % 2) * 0.5) * cell + (rnd() - 0.5) * 0.15 * cell;
      const by = (j + 0.85) * cell;
      const blades = 4 + Math.floor(rnd() * 3);
      for (let b = 0; b < blades; b++) {
        const t0 = blades > 1 ? b / (blades - 1) - 0.5 : 0;
        const ang = -Math.PI / 2 + t0 * 1.6 + (rnd() - 0.5) * 0.2;
        const bend = (t0 >= 0 ? 1 : -1) * (0.4 + rnd() * 0.5);
        const len = cell * (0.5 + rnd() * 0.25) * (1 - Math.abs(t0) * 0.4);
        let px = bx;
        let py = by;
        const steps = 8;
        for (let s = 1; s <= steps; s++) {
          const u = s / steps;
          const a = ang + bend * u * u;
          const qx = px + Math.cos(a) * (len / steps);
          const qy = py + Math.sin(a) * (len / steps);
          segment(ink, n, px, py, qx, qy, Math.max(0.5, 0.012 * n * (1 - u * 0.7)));
          px = qx;
          py = qy;
        }
      }
    }
  }
  return { ink, shade };
}

export function sampleImage(id: Sample, size: number): { data: Uint8ClampedArray; width: number; height: number } {
  const n = Math.min(512, Math.max(64, Math.round(size)));
  const rnd = mulberry32(SEEDS[id]);
  const { ink, shade } = id === 'bricks' ? bricks(n, rnd) : id === 'stones' ? stones(n, rnd) : id === 'tiles' ? tiles(n) : grass(n, rnd);
  // Low-amplitude toroidal variation (whole periods across the picture), like uneven light on paper.
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  const data = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const light = 6 * Math.sin((TAU * (x + 2 * y)) / n + p1) + 4 * Math.sin((TAU * (3 * x - y)) / n + p2);
      const v = 232 + light + shade[i]! - 170 * ink[i]!;
      data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
  }
  return { data, width: n, height: n };
}
