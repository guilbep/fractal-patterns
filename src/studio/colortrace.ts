// Color tracing: a small color image to a few flat, stacked vector shapes, one per color (one plate per color).
// Pure array code: k-means in OKLab, one mask per color, marching squares, smoothing, then path data.

import { curvePathData, fitCurves, smoothChain } from '../curvefit.ts';
import { isolines } from '../isolines.ts';
import { oklchToHex } from '../oklch.ts';
import type { Pt } from '../patterns/util.ts';
import { gaussianBlur } from '../trace.ts';
import { simplify } from '../vectorize.ts';
import { motifBounds } from './motifs.ts';

export interface Rgba {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

export interface ColorShape {
  readonly color: string;
  readonly d: string;
  readonly area: number;
}

export interface TraceColorOptions {
  readonly colors: number;
  readonly size: number;
  readonly smooth: number;
  readonly tolerance: number;
  readonly minArea: number;
  readonly curves: boolean;
}

const decode = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

// sRGB bytes to OKLab (Björn Ottosson's matrices, as in oklch.ts).
function toLab(r8: number, g8: number, b8: number): [number, number, number] {
  const [r, g, b] = [decode(r8 / 255), decode(g8 / 255), decode(b8 / 255)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const labToHex = (L: number, a: number, b: number): string => oklchToHex(L, Math.hypot(a, b), (Math.atan2(b, a) * 180) / Math.PI);

const MAX_SAMPLES = 4096;
const ROUNDS = 12;

export function quantize(img: Rgba, colors: number): { palette: string[]; index: Uint8Array; background: number } {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const k = Math.min(8, Math.max(2, Math.round(colors)));
  const lab = new Float32Array(n * 3);
  const opaque: number[] = [];
  for (let i = 0; i < n; i++) {
    if (data[4 * i + 3]! < 128) continue;
    lab.set(toLab(data[4 * i]!, data[4 * i + 1]!, data[4 * i + 2]!), 3 * i);
    opaque.push(i);
  }
  const stride = Math.max(1, Math.ceil(opaque.length / MAX_SAMPLES));
  const sample = opaque.filter((_, j) => j % stride === 0).sort((p, q) => lab[3 * p]! - lab[3 * q]! || p - q);
  const dist = (i: number, c: Float64Array) => (lab[3 * i]! - c[0]!) ** 2 + (lab[3 * i + 1]! - c[1]!) ** 2 + (lab[3 * i + 2]! - c[2]!) ** 2;
  // Deterministic start: the samples at evenly spaced lightness quantiles.
  const centers = Array.from({ length: k }, (_, c) => {
    const i = sample[Math.floor(((c + 0.5) / k) * sample.length)] ?? 0;
    return Float64Array.from(lab.subarray(3 * i, 3 * i + 3));
  });
  const nearest = (i: number) => {
    let best = 0;
    for (let c = 1; c < k; c++) if (dist(i, centers[c]!) < dist(i, centers[best]!)) best = c;
    return best;
  };
  for (let round = 0; round < ROUNDS && sample.length > 0; round++) {
    const sum = Array.from({ length: k }, () => new Float64Array(4));
    const owner = sample.map(nearest);
    sample.forEach((i, j) => {
      const s = sum[owner[j]!]!;
      for (let t = 0; t < 3; t++) s[t]! += lab[3 * i + t]!;
      s[3]! += 1;
    });
    let moved = false;
    for (let c = 0; c < k; c++) {
      const s = sum[c]!;
      let next: Float64Array<ArrayBuffer>;
      if (s[3]! > 0) next = Float64Array.from([s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!]);
      else {
        // Empty cluster (quantile starts often repeat on flat images): restart it at the sample worst served.
        let far = sample[0]!;
        sample.forEach((i, j) => {
          if (dist(i, centers[owner[j]!]!) > dist(far, centers[nearest(far)]!)) far = i;
        });
        next = Float64Array.from(lab.subarray(3 * far, 3 * far + 3));
      }
      if (next.some((v, t) => v !== centers[c]![t])) moved = true;
      centers[c] = next;
    }
    if (!moved) break;
  }
  const index = new Uint8Array(n);
  for (const i of opaque) index[i] = nearest(i);
  // Background: the cluster covering most of the outer 2 pixel frame.
  const border = new Float64Array(k);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x >= 2 && y >= 2 && x < w - 2 && y < h - 2) continue;
      const i = y * w + x;
      if (data[4 * i + 3]! >= 128) border[index[i]!]! += 1;
    }
  }
  const background = border.indexOf(Math.max(...border));
  for (let i = 0; i < n; i++) if (data[4 * i + 3]! < 128) index[i] = background;
  return { palette: centers.map(([L, a, b]) => labToHex(L!, a!, b!)), index, background };
}

const loopArea = (l: readonly Pt[]) => Math.abs(l.slice(1).reduce((s, [x, y], i) => s + l[i]![0] * y - x * l[i]![1], 0)) / 2;
const isClosed = (l: readonly Pt[]) => l.length > 3 && l[0]![0] === l.at(-1)![0] && l[0]![1] === l.at(-1)![1];
const num = (v: number) => String(Math.round(v * 100) / 100);

/** Sum of the absolute shoelace areas of the sub-paths of `M x y L x y … Z` path data (absolute polyline commands only). */
export function pathArea(d: string): number {
  return d
    .split(/[Mm]/)
    .filter((s) => s.trim())
    .reduce((sum, sub) => {
      const ns = sub
        .replace(/[LlZz]/g, ' ')
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const pts: Pt[] = [];
      for (let i = 0; i + 1 < ns.length; i += 2) pts.push([ns[i]!, ns[i + 1]!]);
      return sum + loopArea([...pts, pts[0]!]);
    }, 0);
}

const PAD = 3; // zero frame around each mask, so shapes touching the image edge still close

export function traceColors(img: Rgba, o: TraceColorOptions): { shapes: ColorShape[]; background: string; box: number } {
  const { width: w, height: h } = img;
  const { palette, index, background } = quantize(img, o.colors);
  const counts = new Float64Array(palette.length);
  for (const c of index) counts[c]! += 1;
  // Stacking order: largest pixel count at the back.
  const order = palette.map((_, c) => c).filter((c) => c !== background && counts[c]! > 0);
  order.sort((p, q) => counts[q]! - counts[p]! || p - q);
  const rank = new Int8Array(palette.length).fill(-1);
  order.forEach((c, r) => (rank[c] = r));
  const s = o.size / Math.max(w, h);
  const ox = (o.size - w * s) / 2;
  const oy = (o.size - h * s) / 2;
  const pw = w + 2 * PAD;
  const shapes: ColorShape[] = [];
  order.forEach((c, r) => {
    // This color plus every color stacked in front of it: plates overlap underneath, no hairline gap.
    const mask = new Float32Array(pw * (h + 2 * PAD));
    let on = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (rank[index[y * w + x]!]! < r) continue;
        mask[(y + PAD) * pw + x + PAD] = 1;
        on++;
      }
    }
    const loops = isolines(gaussianBlur({ data: mask, width: pw, height: h + 2 * PAD }, 0.7), 0.5)
      .filter(isClosed)
      .map((l) => l.map(([x, y]): Pt => [ox + (x - PAD) * s, oy + (y - PAD) * s]))
      .filter((l) => loopArea(l) >= o.minArea)
      .map((l) => smoothChain(l, o.smooth));
    if (loops.length === 0) return;
    const d = o.curves
      ? curvePathData(
          loops.map((l) => fitCurves(l, o.tolerance)),
          2,
        )
      : loops
          .map((l) => {
            const p = simplify(l, o.tolerance).slice(0, -1);
            return 'M' + p.map(([x, y]) => num(x) + ' ' + num(y)).join('L') + 'Z';
          })
          .join('');
    shapes.push({ color: palette[c]!, d, area: on * s * s });
  });
  return { shapes, background: palette[background]!, box: o.size };
}

export function traceSvg(result: { shapes: readonly ColorShape[]; background: string; box: number }, withBackground: boolean): string {
  const b = num(result.box);
  const bg = withBackground ? `<path fill="${result.background}" d="M0 0H${b}V${b}H0Z"/>` : '';
  const paths = result.shapes.map((p) => `<path fill="${p.color}" fill-rule="evenodd" d="${p.d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${b} ${b}" width="${b}" height="${b}">${bg}${paths}</svg>`;
}

const n1 = (v: number) => String(Math.round(v * 10) / 10);

/** The same path with every point mapped by f, written as absolute M, L, C and Z (M L C H V Z, either case, in). */
function mapPath(d: string, f: (x: number, y: number) => Pt): string {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const ARITY: Record<string, number> = { m: 2, l: 2, c: 6, h: 1, v: 1, z: 0 };
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = '';
  let out = '';
  const pt = (px: number, py: number) => f(px, py).map(n1).join(' ');
  for (let i = 0; i < tokens.length;) {
    if (/[A-Za-z]/.test(tokens[i]!)) cmd = tokens[i++]!;
    const lo = cmd.toLowerCase();
    if (lo === 'z') {
      out += 'Z';
      [x, y] = [sx, sy];
      continue;
    }
    const n = ARITY[lo];
    if (!n) break;
    const v = tokens.slice(i, i + n).map(Number);
    if (v.length < n || v.some((q) => !Number.isFinite(q))) break;
    i += n;
    const rel = cmd === lo;
    if (lo === 'h' || lo === 'v') {
      if (lo === 'h') x = v[0]! + (rel ? x : 0);
      else y = v[0]! + (rel ? y : 0);
      out += 'L' + pt(x, y);
      continue;
    }
    const abs = v.map((q, j) => q + (rel ? (j % 2 === 0 ? x : y) : 0));
    const pts: string[] = [];
    for (let j = 0; j < n; j += 2) pts.push(pt(abs[j]!, abs[j + 1]!));
    out += (lo === 'c' ? 'C' : lo === 'm' ? 'M' : 'L') + pts.join(' ');
    [x, y] = [abs[n - 2]!, abs[n - 1]!];
    if (lo === 'm') {
      [sx, sy] = [x, y];
      cmd = rel ? 'l' : 'L';
    }
  }
  return out;
}

/** Crop a trace to its subject: scale and move the shapes so that their bounds fill the box less the margin
 * (a share of the box), centered; with anchor 'bottom' the subject's base sits at the bottom center (motifs grow upward). */
export function cropToSubject(
  result: { shapes: readonly ColorShape[]; background: string; box: number },
  margin = 0.04,
  anchor: 'center' | 'bottom' = 'center',
): { shapes: ColorShape[]; background: string; box: number } {
  const { box } = result;
  const b = motifBounds(result.shapes.map((s) => s.d).join(''));
  const bw = b.maxX - b.minX;
  const bh = b.maxY - b.minY;
  if (!(bw > 0 && bh > 0)) return { ...result, shapes: [...result.shapes] };
  const k = (box * (1 - 2 * margin)) / Math.max(bw, bh);
  const tx = box / 2 - ((b.minX + b.maxX) / 2) * k;
  const ty = anchor === 'bottom' ? box * (1 - margin) - b.maxY * k : box / 2 - ((b.minY + b.maxY) / 2) * k;
  const shapes = result.shapes.map((s) => ({ color: s.color, d: mapPath(s.d, (x, y) => [x * k + tx, y * k + ty]), area: s.area * k * k }));
  return { shapes, background: result.background, box };
}

/** A flower drawn by code with soft edges, for trying the custom motif without a file: on white, a green stem and leaf,
 * pink petals, a yellow heart. */
export function sampleFlower(size: number): Rgba {
  const data = new Uint8ClampedArray(size * size * 4);
  const s = size / 100;
  // Signed distances (negative inside), in 0..100 units.
  const disc = (x: number, y: number, cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) - r;
  const ellipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, a: number) => {
    const [dx, dy] = [x - cx, y - cy];
    const [u, v] = [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)];
    return (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry);
  };
  const layers: [readonly [number, number, number], (x: number, y: number) => number][] = [
    [[60, 140, 60], (x, y) => (y > 40 && y < 95 ? Math.abs(x - 50) - 2.2 : 9)],
    [[60, 140, 60], (x, y) => ellipse(x, y, 62, 72, 12, 5, -0.6)],
    [
      [230, 110, 150],
      (x, y) =>
        Math.min(
          ...[0, 1, 2, 3, 4].map((i) =>
            ellipse(
              x,
              y,
              50 + 14 * Math.sin((i * 2 * Math.PI) / 5),
              32 - 14 * Math.cos((i * 2 * Math.PI) / 5),
              13,
              8,
              (i * 2 * Math.PI) / 5 + Math.PI / 2,
            ),
          ),
        ),
    ],
    [[250, 200, 40], (x, y) => disc(x, y, 50, 32, 7)],
  ];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const [x, y] = [(px + 0.5) / s, (py + 0.5) / s];
      let c = [255, 255, 255];
      for (const [rgb, sd] of layers) {
        const a = Math.min(1, Math.max(0, 0.5 - sd(x, y) * s)); // one pixel soft edge
        c = c.map((v, j) => v + (rgb[j]! - v) * a);
      }
      data.set([...c, 255], 4 * (py * size + px));
    }
  }
  return { width: size, height: size, data };
}
