// Ink tracing: one-color line art (ink on paper) to ONE filled even-odd path, the ink with its real line width.
// Pure array code: darkness, Otsu threshold, mask, marching squares, smoothing, then path data.

import { curvePathData, fitCurves, smoothChain } from '../curvefit.ts';
import { isolines } from '../isolines.ts';
import type { Pt } from '../patterns/util.ts';
import { gaussianBlur } from '../trace.ts';
import { simplify } from '../vectorize.ts';
import type { Rgba } from './colortrace.ts';

export interface InkResult {
  readonly d: string;
  readonly box: number;
  readonly loops: number;
  readonly holes: number;
  readonly points: number;
  readonly coverage: number;
  readonly contrast: number;
  readonly detailUsed: number;
  /** Even-odd ink area in output units squared: outer loops minus holes. */
  readonly area: number;
}

// Darkness 0..1 = 1 - luma of the gamma-encoded sRGB values (Rec. 709 weights). Gamma-encoded, not linear: in linear
// light a light gray (#ccc) sits halfway to the ink and Otsu would split the checkerboard tones instead of the ink.
// A see-through pixel is composited over the paper: white when the opaque pixels are mostly dark ink, black when they
// are mostly light ink (white lines on a transparent ground).
function darkness(img: Rgba): Float32Array {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const raw = new Float32Array(n);
  let sum = 0;
  let opaque = 0;
  for (let i = 0; i < n; i++) {
    raw[i] = 1 - (0.2126 * data[4 * i]! + 0.7152 * data[4 * i + 1]! + 0.0722 * data[4 * i + 2]!) / 255;
    if (data[4 * i + 3]! >= 128) {
      sum += raw[i]!;
      opaque++;
    }
  }
  const paper = opaque > 0 && sum / opaque < 0.5 ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const a = data[4 * i + 3]! / 255;
    raw[i] = raw[i]! * a + paper * (1 - a);
  }
  return raw;
}

// Otsu on the histogram bins from..255.
function split(hist: Float64Array, from: number): { threshold: number; inkIsDark: boolean; contrast: number; darkMean: number } {
  let [n, total] = [0, 0];
  for (let b = from; b < 256; b++) [n, total] = [n + hist[b]!, total + b * hist[b]!];
  let [best, w0, s0] = [-1, 0, 0];
  let res = { threshold: 1, inkIsDark: true, contrast: 0, darkMean: 0 };
  for (let t = from; t < 255; t++) {
    w0 += hist[t]!;
    s0 += t * hist[t]!;
    const w1 = n - w0;
    if (w0 === 0 || w1 === 0) continue;
    const [m0, m1] = [s0 / w0, (total - s0) / w1];
    const between = w0 * w1 * (m1 - m0) ** 2;
    if (between > best) {
      best = between;
      res = { threshold: (t + 0.5) / 255, inkIsDark: w1 <= w0, contrast: (m1 - m0) / 255, darkMean: m1 / 255 };
    }
  }
  return res;
}

function otsu(dark: Float32Array): { threshold: number; inkIsDark: boolean; contrast: number } {
  const hist = new Float64Array(256);
  for (const v of dark) hist[Math.min(255, Math.max(0, Math.round(v * 255)))]! += 1;
  const first = split(hist, 0);
  // Both classes light (the darker one still above 0.55 luma): Otsu split paper against paper, e.g. the white and gray
  // squares of a baked transparency checkerboard under sparse ink. Split again inside the darker class; keep that split
  // only if it separates more than the first did, so a pale drawing on plain paper keeps its first split.
  if (first.darkMean < 0.45) {
    const again = split(hist, Math.round(first.threshold * 255 - 0.5) + 1);
    if (again.contrast > first.contrast) return { threshold: again.threshold, inkIsDark: true, contrast: again.contrast };
  }
  return { threshold: first.threshold, inkIsDark: first.inkIsDark, contrast: first.contrast };
}

/** Otsu's split of the darkness histogram: the smaller class is the ink. Contrast below 0.15: not two-tone. */
export function inkThreshold(img: Rgba): { threshold: number; inkIsDark: boolean; contrast: number } {
  return otsu(darkness(img));
}

export function inkMask(
  img: Rgba,
  o: { threshold?: number; invert?: boolean },
): { mask: Float32Array; width: number; height: number; coverage: number; contrast: number } {
  const dark = darkness(img);
  const auto = otsu(dark);
  const t = o.threshold ?? auto.threshold;
  const dk = auto.inkIsDark !== Boolean(o.invert);
  const mask = new Float32Array(dark.length);
  let on = 0;
  for (let i = 0; i < dark.length; i++) {
    if (dark[i]! > t === dk) {
      mask[i] = 1;
      on++;
    }
  }
  return { mask, width: img.width, height: img.height, coverage: dark.length ? on / dark.length : 0, contrast: auto.contrast };
}

const PAD = 3;
const signedArea = (l: readonly Pt[]) => l.slice(1).reduce((s, [x, y], i) => s + l[i]![0] * y - x * l[i]![1], 0) / 2;
const isClosed = (l: readonly Pt[]) => l.length > 3 && l[0]![0] === l.at(-1)![0] && l[0]![1] === l.at(-1)![1];
const num = (v: number) => String(Math.round(v * 100) / 100);

function inside([px, py]: Pt, l: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
    const [xi, yi] = l[i]!;
    const [xj, yj] = l[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const SAFE_LENGTH = 20000; // safePathData's cap

export function traceInk(
  img: Rgba,
  o: {
    size: number;
    threshold?: number;
    invert?: boolean;
    detail: number;
    smooth: number;
    minArea: number;
    curves: boolean;
    maxPoints?: number;
    /** Path data cap, default safePathData's 20,000. */
    maxLength?: number;
  },
): InkResult {
  const { width: w, height: h } = img;
  const { mask, coverage, contrast } = inkMask(img, o);
  const pw = w + 2 * PAD;
  const padded = new Float32Array(pw * (h + 2 * PAD));
  for (let y = 0; y < h; y++) padded.set(mask.subarray(y * w, y * w + w), (y + PAD) * pw + PAD);
  const s = o.size / Math.max(w, h);
  const ox = (o.size - w * s) / 2;
  const oy = (o.size - h * s) / 2;
  const loops = isolines(gaussianBlur({ data: padded, width: pw, height: h + 2 * PAD }, 0.6), 0.5)
    .filter(isClosed)
    .map((l) => l.map(([x, y]): Pt => [ox + (x - PAD) * s, oy + (y - PAD) * s]))
    .filter((l) => Math.abs(signedArea(l)) >= o.minArea)
    .map((l) => smoothChain(l, o.smooth));
  const areas = loops.map((l) => Math.abs(signedArea(l)));
  const boxes = loops.map((l) =>
    l.reduce(
      (b, [x, y]) => [Math.min(b[0]!, x), Math.min(b[1]!, y), Math.max(b[2]!, x), Math.max(b[3]!, y)],
      [Infinity, Infinity, -Infinity, -Infinity],
    ),
  );
  // ponytail: O(loops^2) nesting test with a bounding box prefilter; a sweep if images with 10k+ loops show up.
  let holes = 0;
  let area = 0;
  loops.forEach((l, i) => {
    const p = l[0]!;
    let depth = 0;
    loops.forEach((m, j) => {
      const b = boxes[j]!;
      if (areas[j]! > areas[i]! && p[0] >= b[0]! && p[0] <= b[2]! && p[1] >= b[1]! && p[1] <= b[3]! && inside(p, m)) depth++;
    });
    if (depth % 2) holes++;
    area += depth % 2 ? -areas[i]! : areas[i]!;
  });
  const maxPoints = o.maxPoints ?? 6000;
  let tol = o.detail;
  let d = '';
  let points = 0;
  for (let round = 0; round < 60; round++, tol = Math.max(tol, 0.01) * 1.3) {
    if (o.curves) {
      const chains = loops.map((l) => fitCurves(l, tol));
      points = chains.reduce((n, c) => n + 3 * c.length, 0);
      d = curvePathData(chains, 2);
    } else {
      const polys = loops.map((l) => simplify(l, tol).slice(0, -1)).filter((p) => p.length >= 3);
      points = polys.reduce((n, p) => n + p.length, 0);
      d = polys.map((p) => 'M' + p.map(([x, y]) => num(x) + ' ' + num(y)).join('L') + 'Z').join('');
    }
    if (points <= maxPoints && d.length <= (o.maxLength ?? SAFE_LENGTH)) break;
  }
  return { d, box: o.size, loops: loops.length, holes, points, coverage, contrast, detailUsed: tol, area };
}

export function inkMotif(result: { d: string; box: number }, color: string): { shapes: { color: string; d: string }[]; box: number } {
  return { shapes: result.d ? [{ color, d: result.d }] : [], box: result.box };
}

export function inkSvg(result: { d: string; box: number }, color: string, background: string | null): string {
  const b = num(result.box);
  const bg = background ? `<path fill="${background}" d="M0 0H${b}V${b}H0Z"/>` : '';
  const ink = result.d ? `<path fill="${color}" fill-rule="evenodd" d="${result.d}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b} ${b}" width="${b}" height="${b}">${bg}${ink}</svg>`;
}
