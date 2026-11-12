// Color tracing: a small color image to a few flat, stacked vector shapes, one per color (one plate per color).
// Pure array code: k-means in OKLab, one mask per color, marching squares, smoothing, then path data.

import { curvePathData, fitCurves, smoothChain } from '../curvefit.ts';
import { isolines } from '../isolines.ts';
import { oklchToHex } from '../oklch.ts';
import type { Pt } from '../patterns/util.ts';
import { gaussianBlur } from '../trace.ts';
import { simplify } from '../vectorize.ts';

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
