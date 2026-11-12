// Pixels to a binary edge map. Typed arrays only, so it runs in the browser and in Node.

export interface Gray {
  readonly data: Float32Array;
  readonly width: number;
  readonly height: number;
}

export const DETECTORS = ['sobel', 'prewitt', 'roberts', 'laplacian', 'canny', 'scharr', 'xdog'] as const; // append only: ids are persisted
export type Detector = (typeof DETECTORS)[number];

export const DETECTOR_LABELS: Readonly<Record<Detector, string>> = {
  sobel: 'Sobel',
  prewitt: 'Prewitt',
  roberts: 'Roberts cross',
  laplacian: 'Laplacian',
  canny: 'Canny',
  scharr: 'Scharr',
  xdog: 'XDoG (ink lines)',
};

export function toGray(rgba: ArrayLike<number>, width: number, height: number): Gray {
  if (rgba.length !== width * height * 4) throw new Error(`expected ${width * height * 4} values, got ${rgba.length}`);
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const r = rgba[i * 4] ?? 0;
    const g = rgba[i * 4 + 1] ?? 0;
    const b = rgba[i * 4 + 2] ?? 0;
    const a = (rgba[i * 4 + 3] ?? 0) / 255;
    data[i] = a * (0.299 * r + 0.587 * g + 0.114 * b) + (1 - a) * 255;
  }
  return { data, width, height };
}

/** Pixel value with clamp to edge. */
function at(g: Gray, x: number, y: number): number {
  const cx = x < 0 ? 0 : x >= g.width ? g.width - 1 : x;
  const cy = y < 0 ? 0 : y >= g.height ? g.height - 1 : y;
  return g.data[cy * g.width + cx] ?? 0;
}

/** Gx and Gy for a 3x3 kernel whose Gx rows are [-1 0 1] scaled by `side, mid, side`; Gy is the transpose. */
function kernel3(g: Gray, x: number, y: number, side: number, mid: number): [number, number] {
  const gx =
    side * (at(g, x + 1, y - 1) - at(g, x - 1, y - 1)) +
    mid * (at(g, x + 1, y) - at(g, x - 1, y)) +
    side * (at(g, x + 1, y + 1) - at(g, x - 1, y + 1));
  const gy =
    side * (at(g, x - 1, y + 1) - at(g, x - 1, y - 1)) +
    mid * (at(g, x, y + 1) - at(g, x, y - 1)) +
    side * (at(g, x + 1, y + 1) - at(g, x + 1, y - 1));
  return [gx, gy];
}

export function gradient(g: Gray, d: Exclude<Detector, 'canny' | 'xdog'>): Float32Array {
  const out = new Float32Array(g.width * g.height);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      let m: number;
      if (d === 'sobel' || d === 'prewitt') {
        const [gx, gy] = kernel3(g, x, y, 1, d === 'sobel' ? 2 : 1);
        m = Math.hypot(gx, gy);
      } else if (d === 'scharr') {
        // Scharr weights sum to 16 per side, Sobel to 4: divide by 4 so magnitudes compare with Sobel.
        const [gx, gy] = kernel3(g, x, y, 3, 10);
        m = Math.hypot(gx, gy) / 4;
      } else if (d === 'roberts') {
        m = Math.hypot(at(g, x, y) - at(g, x + 1, y + 1), at(g, x + 1, y) - at(g, x, y + 1));
      } else {
        m = Math.abs(at(g, x - 1, y) + at(g, x + 1, y) + at(g, x, y - 1) + at(g, x, y + 1) - 4 * at(g, x, y));
      }
      out[y * g.width + x] = m;
    }
  }
  return out;
}

export function gaussianBlur(g: Gray, sigma: number): Gray {
  if (sigma <= 0) return { data: Float32Array.from(g.data), width: g.width, height: g.height };
  const r = Math.ceil(3 * sigma);
  const w: number[] = [];
  for (let i = -r; i <= r; i++) w.push(Math.exp(-(i * i) / (2 * sigma * sigma)));
  const sum = w.reduce((s, v) => s + v, 0);
  const k = w.map((v) => v / sum);
  const pass = (src: Gray, dx: number, dy: number): Gray => {
    const data = new Float32Array(src.data.length);
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        let v = 0;
        for (let i = -r; i <= r; i++) v += (k[i + r] ?? 0) * at(src, x + i * dx, y + i * dy);
        data[y * src.width + x] = v;
      }
    }
    return { data, width: src.width, height: src.height };
  };
  return pass(pass(g, 1, 0), 0, 1);
}

export function edges(g: Gray, d: Detector, threshold: number): Uint8Array {
  if (d === 'canny') return canny(g, threshold);
  if (d === 'xdog') return xdog(g, threshold);
  const m = gradient(g, d);
  const out = new Uint8Array(m.length);
  let max = 0;
  for (const v of m) if (v > max) max = v;
  if (max === 0) return out;
  const t = threshold * max;
  for (let i = 0; i < m.length; i++) if ((m[i] ?? 0) >= t) out[i] = 1;
  return out;
}

function canny(g: Gray, threshold: number): Uint8Array {
  const b = gaussianBlur(g, 1.4);
  const { width: w, height: h } = b;
  const mag = new Float32Array(w * h);
  const dir = new Uint8Array(w * h); // 0: horizontal, 1: 45°, 2: vertical, 3: 135°
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [gx, gy] = kernel3(b, x, y, 1, 2);
      const m = Math.hypot(gx, gy);
      mag[y * w + x] = m;
      if (m > max) max = m;
      const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      dir[y * w + x] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3;
    }
  }
  const out = new Uint8Array(w * h);
  if (max === 0) return out;

  // Non-maximum suppression: keep a pixel only if it is >= both neighbours along the gradient.
  const OFFSETS = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
  ] as const;
  const magAt = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : (mag[y * w + x] ?? 0));
  const thin = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mag[i] ?? 0;
      const [ox, oy] = OFFSETS[dir[i] ?? 0] ?? [1, 0];
      if (m >= magAt(x + ox, y + oy) && m >= magAt(x - ox, y - oy)) thin[i] = m;
    }
  }

  // Hysteresis: flood from strong pixels through 8-connected weak ones.
  const high = threshold * max;
  const low = 0.4 * high;
  const stack: number[] = [];
  for (let i = 0; i < thin.length; i++) {
    if ((thin[i] ?? 0) >= high && (thin[i] ?? 0) > 0) {
      out[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length > 0) {
    const i = stack.pop() ?? 0;
    const x = i % w;
    const y = (i - x) / w;
    for (let ny = y - 1; ny <= y + 1; ny++) {
      for (let nx = x - 1; nx <= x + 1; nx++) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (out[j] === 0 && (thin[j] ?? 0) >= low && (thin[j] ?? 0) > 0) {
          out[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return out;
}

/**
 * Extended difference of Gaussians (Winnemöller et al. 2012): D = G(sigma) - gamma * G(k * sigma), thinned to 1 px lines.
 * D is divided by the local brightness (the wide blur, plus 64 so near-black areas do not blow up), so a stroke reads the
 * same in shadow and in light. Threshold mapping: a pixel is an edge when that ratio < -0.25 * threshold, so threshold 0
 * keeps every darkening, and a higher threshold asks for a deeper relative dip, so it gives fewer edge pixels.
 */
export function xdogMask(g: Gray, threshold: number): Uint8Array {
  const sigma = 1.0;
  const k = 1.6;
  const gamma = 0.98;
  const narrow = gaussianBlur(g, sigma).data;
  const wide = gaussianBlur(g, k * sigma).data;
  const level = -0.25 * threshold;
  const out = new Uint8Array(narrow.length);
  for (let i = 0; i < out.length; i++) {
    const w = wide[i] ?? 0;
    if (((narrow[i] ?? 0) - gamma * w) / (w + 64) < level) out[i] = 1;
  }
  return out;
}

function xdog(g: Gray, threshold: number): Uint8Array {
  const m = thin(xdogMask(g, threshold), g.width, g.height);
  pruneSpurs(m, g.width, g.height, 3, 2);
  return m;
}

/** Remove end branches of at most `len` pixels that end in a junction, `rounds` times. In place. */
function pruneSpurs(m: Uint8Array, width: number, height: number, len: number, rounds: number): void {
  const nbrs = (i: number): number[] => {
    const x = i % width;
    const y = (i - x) / width;
    const out: number[] = [];
    for (let ny = y - 1; ny <= y + 1; ny++)
      for (let nx = x - 1; nx <= x + 1; nx++)
        if ((nx !== x || ny !== y) && nx >= 0 && ny >= 0 && nx < width && ny < height && m[ny * width + nx] === 1)
          out.push(ny * width + nx);
    return out;
  };
  for (let r = 0; r < rounds; r++) {
    const cut: number[] = [];
    for (let i = 0; i < m.length; i++) {
      if (m[i] !== 1 || nbrs(i).length !== 1) continue;
      const branch = [i];
      let prev = -1;
      let cur = i;
      for (;;) {
        const next = nbrs(cur).filter((j) => j !== prev && !branch.includes(j));
        if (next.length !== 1 || nbrs(next[0] ?? 0).length > 2) {
          // A junction ahead (or behind `next`): short branch is a spur.
          if (next.length >= 1 && branch.length <= len) cut.push(...branch);
          break;
        }
        if (branch.length >= len) break;
        prev = cur;
        cur = next[0] ?? 0;
        branch.push(cur);
      }
    }
    if (cut.length === 0) break;
    for (const i of cut) m[i] = 0;
  }
}

/** Zhang-Suen thinning to 1 px wide lines. Never sets a pixel the input did not set. At most 20 iterations. */
export function thin(map: Uint8Array, width: number, height: number): Uint8Array {
  const m = Uint8Array.from(map);
  const p = (x: number, y: number) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : (m[y * width + x] ?? 0));
  const remove: number[] = [];
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    for (const step of [0, 1]) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (m[y * width + x] !== 1) continue;
          // Neighbours P2..P9, clockwise from north.
          const n = [
            p(x, y - 1),
            p(x + 1, y - 1),
            p(x + 1, y),
            p(x + 1, y + 1),
            p(x, y + 1),
            p(x - 1, y + 1),
            p(x - 1, y),
            p(x - 1, y - 1),
          ];
          const b = n.reduce((s, v) => s + v, 0);
          if (b < 2 || b > 6) continue;
          let a = 0;
          for (let i = 0; i < 8; i++) if (n[i] === 0 && n[(i + 1) % 8] === 1) a++;
          if (a !== 1) continue;
          const [p2, , p4, , p6, , p8] = n;
          if (step === 0 ? p2! * p4! * p6! === 0 && p4! * p6! * p8! === 0 : p2! * p4! * p8! === 0 && p2! * p6! * p8! === 0)
            remove.push(y * width + x);
        }
      }
      for (const i of remove) m[i] = 0;
      if (remove.length > 0) changed = true;
      remove.length = 0;
    }
    if (!changed) break;
  }
  return m;
}
