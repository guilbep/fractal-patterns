// Experimental: polylines -> a few smooth cubic Bézier curves (Schneider 1990 least squares fit),
// then optional refinement of the control points by gradient ascent on a scalar field (blurred edge strength).
// Pure: no DOM, no randomness.
import type { Pt } from './patterns/util.ts';

export type Cubic = readonly [Pt, Pt, Pt, Pt];

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Pt, s: number): Pt => [a[0] * s, a[1] * s];
const dot = (a: Pt, b: Pt) => a[0] * b[0] + a[1] * b[1];
const len = (a: Pt) => Math.hypot(a[0], a[1]);
const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
function unit(a: Pt, fallback: Pt): Pt {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l] : fallback;
}

const bern = (t: number): [number, number, number, number] => {
  const s = 1 - t;
  return [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
};
function at(c: Cubic, t: number): Pt {
  const [b0, b1, b2, b3] = bern(t);
  return [b0 * c[0][0] + b1 * c[1][0] + b2 * c[2][0] + b3 * c[3][0], b0 * c[0][1] + b1 * c[1][1] + b2 * c[2][1] + b3 * c[3][1]];
}
// First and second derivatives.
function d1(c: Cubic, t: number): Pt {
  const s = 1 - t;
  const a = mul(sub(c[1], c[0]), 3 * s * s);
  const b = mul(sub(c[2], c[1]), 6 * s * t);
  const e = mul(sub(c[3], c[2]), 3 * t * t);
  return add(add(a, b), e);
}
function d2(c: Cubic, t: number): Pt {
  const a = mul(add(sub(c[2], mul(c[1], 2)), c[0]), 6 * (1 - t));
  const b = mul(add(sub(c[3], mul(c[2], 2)), c[1]), 6 * t);
  return add(a, b);
}

function chordParams(pts: readonly Pt[]): number[] {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push((u[i - 1] ?? 0) + len(sub(pts[i]!, pts[i - 1]!)));
  const total = u[u.length - 1] || 1;
  return u.map((v) => v / total);
}

// Least squares for the two handle lengths, tangents fixed (t2 points from the end back into the curve).
function generate(pts: readonly Pt[], u: readonly number[], t1: Pt, t2: Pt): Cubic {
  const p0 = pts[0]!;
  const p3 = pts[pts.length - 1]!;
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  pts.forEach((p, i) => {
    const [b0, b1, b2, b3] = bern(u[i] ?? 0);
    const a1 = mul(t1, b1);
    const a2 = mul(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);
    const tmp = sub(p, add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a1, tmp);
    x1 += dot(a2, tmp);
  });
  const det = c00 * c11 - c01 * c01;
  const dist = len(sub(p3, p0));
  const eps = 1e-6 * dist;
  let al = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det;
  let ar = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det;
  // Degenerate (collinear points) or negative handles: Wu/Barsky heuristic.
  if (Math.abs(det) < 1e-12 || !(al > eps) || !(ar > eps)) al = ar = dist / 3;
  return [p0, add(p0, mul(t1, al)), add(p3, mul(t2, ar)), p3];
}

function worst(pts: readonly Pt[], c: Cubic, u: readonly number[]): { err: number; i: number } {
  let err = 0;
  let i = Math.floor(pts.length / 2);
  pts.forEach((p, k) => {
    const d = len(sub(at(c, u[k] ?? 0), p));
    if (d > err && k > 0 && k < pts.length - 1) {
      err = d;
      i = k;
    }
  });
  return { err, i };
}

// One Newton step per parameter on |Q(u) - p|^2.
function reparam(pts: readonly Pt[], c: Cubic, u: readonly number[]): number[] {
  return pts.map((p, i) => {
    const t = u[i] ?? 0;
    const q = sub(at(c, t), p);
    const q1 = d1(c, t);
    const den = dot(q1, q1) + dot(q, d2(c, t));
    const v = den === 0 ? t : t - dot(q, q1) / den;
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : t;
  });
}

function fitPiece(pts: readonly Pt[], t1: Pt, t2: Pt, tol: number, out: Cubic[]): void {
  const p0 = pts[0]!;
  const p3 = pts[pts.length - 1]!;
  if (pts.length === 2) {
    const dist = len(sub(p3, p0)) / 3;
    out.push([p0, add(p0, mul(t1, dist)), add(p3, mul(t2, dist)), p3]);
    return;
  }
  let u = chordParams(pts);
  let c = generate(pts, u, t1, t2);
  let { err, i } = worst(pts, c, u);
  for (let k = 0; k < 4 && err > tol && err < 4 * tol; k++) {
    u = reparam(pts, c, u);
    c = generate(pts, u, t1, t2);
    ({ err, i } = worst(pts, c, u));
  }
  if (err <= tol) {
    out.push(c);
    return;
  }
  const tc = unit(sub(pts[i - 1]!, pts[i + 1]!), mul(t2, 1));
  fitPiece(pts.slice(0, i + 1), t1, tc, tol, out);
  fitPiece(pts.slice(i), mul(tc, -1), t2, tol, out);
}

const WINDOW = 2; // ponytail: corner window in points, not in px; fine for the simplified traced polylines.
const CORNER = (60 * Math.PI) / 180;
const SMOOTH_START = (30 * Math.PI) / 180;

function turn(a: Pt, b: Pt, c: Pt): number {
  const u = sub(b, a);
  const v = sub(c, b);
  const lu = len(u);
  const lv = len(v);
  return lu === 0 || lv === 0 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (lu * lv))));
}

export function fitCurves(poly: readonly Pt[], tolerance: number): Cubic[] {
  const pts = poly.filter((p, i) => i === 0 || !same(p, poly[i - 1]!));
  if (pts.length < 2) return [];
  const closed = pts.length > 3 && same(pts[0]!, pts[pts.length - 1]!);
  const ring = closed ? pts.slice(0, -1) : pts; // distinct points; for a closed one, indices wrap
  const n = ring.length;
  const get = (i: number) => ring[((i % n) + n) % n]!;
  const turns = ring.map((p, i) => {
    const w = closed ? WINDOW : Math.min(WINDOW, i, n - 1 - i);
    return w === 0 ? 0 : turn(get(i - w), p, get(i + w));
  });
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = turns[i] ?? 0;
    if (t <= CORNER) continue;
    let peak = true;
    for (let k = -WINDOW; k <= WINDOW && peak; k++) {
      const j = closed ? (((i + k) % n) + n) % n : i + k;
      if (k !== 0 && j >= 0 && j < n && ((turns[j] ?? 0) > t || ((turns[j] ?? 0) === t && k < 0))) peak = false;
    }
    if (peak && !(corners.length && i - corners[corners.length - 1]! <= WINDOW)) corners.push(i);
  }
  let seq = pts;
  let smoothStart = false;
  if (closed) {
    const s = corners[0] ?? 0; // start the loop at a corner when there is one
    seq = [...ring.slice(s), ...ring.slice(0, s), ring[s]!];
    for (let k = 0; k < corners.length; k++) corners[k] = (corners[k]! - s + n) % n;
    smoothStart = corners.length === 0 && turn(get(-1), get(0), get(1)) < SMOOTH_START;
  }
  const cuts = [0, ...corners.filter((c) => c > 0 && c < seq.length - 1), seq.length - 1];
  const out: Cubic[] = [];
  const last = seq.length - 1;
  const tStart = smoothStart ? unit(sub(seq[1]!, seq[last - 1]!), [1, 0]) : null;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const piece = seq.slice(cuts[k], cuts[k + 1]! + 1);
    const a = piece[0]!;
    const b = piece[piece.length - 1]!;
    const chord = unit(sub(b, a), [1, 0]);
    const t1 = k === 0 && tStart ? tStart : unit(sub(piece[1]!, a), chord);
    const t2 = k === cuts.length - 2 && tStart ? mul(tStart, -1) : unit(sub(piece[piece.length - 2]!, b), mul(chord, -1));
    fitPiece(piece, t1, t2, tolerance, out);
  }
  return out;
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return len(sub(p, add(a, mul(ab, t))));
}

export function maxError(poly: readonly Pt[], curves: readonly Cubic[]): number {
  const samples = curves.flatMap((c) => Array.from({ length: 33 }, (_, i) => at(c, i / 32)));
  let max = 0;
  for (const p of poly) {
    let best = Infinity;
    for (let i = 0; i + 1 < samples.length; i++) best = Math.min(best, segDist(p, samples[i]!, samples[i + 1]!));
    if (samples.length === 1) best = len(sub(p, samples[0]!));
    if (best > max) max = best;
  }
  return max;
}

// Same number rule as pathData in scene.ts (copied, it is not exported).
function num(n: number, precision: number): string {
  let s = n.toFixed(precision);
  if (s.includes('.')) s = s.replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
}

// Absolute M, then relative c (one letter per sub-path, repeated numbers after it), Z when the chain closes.
export function curvePathData(chains: readonly Cubic[][], precision: number): string {
  const f = 10 ** precision;
  const r = (v: number) => Math.round(v * f) / f;
  const nums = (ns: number[]) =>
    ns.reduce((acc, n, i) => {
      const s = num(n, precision);
      return acc + (i > 0 && !s.startsWith('-') ? ' ' : '') + s;
    }, '');
  let d = '';
  for (const chain of chains) {
    const first = chain[0];
    if (!first) continue;
    let start: Pt = [r(first[0][0]), r(first[0][1])];
    d += 'M' + nums([...start]);
    const ns: number[] = [];
    for (const c of chain) {
      if (!same(c[0], start) && ns.length) {
        // A gap inside a chain: a new sub-path.
        d += 'c' + nums(ns);
        ns.length = 0;
        start = [r(c[0][0]), r(c[0][1])];
        d += 'M' + nums([...start]);
      }
      for (const p of [c[1], c[2], c[3]]) ns.push(r(r(p[0]) - start[0]), r(r(p[1]) - start[1]));
      start = [r(c[3][0]), r(c[3][1])];
    }
    d += 'c' + nums(ns);
    const last = chain[chain.length - 1]!;
    if (chain.length > 1 && same(last[3], first[0])) d += 'Z';
  }
  return d;
}

export interface Field {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;
}

export function sampleField(f: Field, x: number, y: number): number {
  const cx = Math.min(f.width - 1, Math.max(0, x));
  const cy = Math.min(f.height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(f.width - 1, x0 + 1);
  const y1 = Math.min(f.height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const v = (i: number, j: number) => f.data[j * f.width + i] ?? 0;
  return (v(x0, y0) * (1 - fx) + v(x1, y0) * fx) * (1 - fy) + (v(x0, y1) * (1 - fx) + v(x1, y1) * fx) * fy;
}

export function fieldGradient(f: Field, x: number, y: number): Pt {
  const h = 0.5;
  return [(sampleField(f, x + h, y) - sampleField(f, x - h, y)) / (2 * h), (sampleField(f, x, y + h) - sampleField(f, x, y - h)) / (2 * h)];
}

const SAMPLES = Array.from({ length: 16 }, (_, i) => i / 15);

export function curveScore(curves: readonly Cubic[], f: Field): number {
  if (curves.length === 0) return 0;
  let s = 0;
  for (const c of curves) for (const t of SAMPLES) s += sampleField(f, ...at(c, t));
  return s / (curves.length * SAMPLES.length);
}

// Gradient ascent on mean(field along the curves) - smooth * sum |inner handle - chord third|^2.
export function refine(curves: readonly Cubic[], f: Field, o: { steps: number; rate: number; smooth: number }): Cubic[] {
  if (curves.length === 0 || o.steps <= 0) return curves.map((c) => [...c] as unknown as Cubic);
  // Unique points: a joint (end equal to the next start, or last end equal to first start) is one point.
  const pts: [number, number][] = [];
  const idx: [number, number, number, number][] = [];
  curves.forEach((c, k) => {
    const prev = curves[k - 1];
    const a = prev && same(prev[3], c[0]) ? idx[k - 1]![3] : pts.push([...c[0]]) - 1;
    const b = pts.push([...c[1]]) - 1;
    const e = pts.push([...c[2]]) - 1;
    const closes = k === curves.length - 1 && curves.length > 1 && same(c[3], curves[0]![0]);
    const d = closes ? idx[0]![0] : pts.push([...c[3]]) - 1;
    idx.push([a, b, e, d]);
  });
  // Smooth joints: the incoming and outgoing handles are collinear at the start.
  const joints: [number, number, number][] = [];
  idx.forEach((q, k) => {
    const next = idx[(k + 1) % idx.length]!;
    if (next === q || next[0] !== q[3]) return;
    const p = pts[q[3]]!;
    const u = unit(sub(p, pts[q[2]]!), [0, 0]);
    const v = unit(sub(pts[next[1]]!, p), [0, 0]);
    if (len(u) > 0 && len(v) > 0 && dot(u, v) > 1 - 1e-6) joints.push([q[2], q[3], next[1]]);
  });
  const n = idx.length * SAMPLES.length;
  const weights = SAMPLES.map(bern);
  for (let step = 0; step < o.steps; step++) {
    const g = pts.map((): [number, number] => [0, 0]);
    for (const q of idx) {
      const c = q.map((i) => pts[i]!) as unknown as Cubic;
      weights.forEach((w, s) => {
        const [gx, gy] = fieldGradient(f, ...at(c, SAMPLES[s]!));
        q.forEach((i, j) => {
          g[i]![0] += (w[j]! * gx) / n;
          g[i]![1] += (w[j]! * gy) / n;
        });
      });
      const [p0, p1, p2, p3] = c;
      const r1 = sub(p1, add(mul(p0, 2 / 3), mul(p3, 1 / 3)));
      const r2 = sub(p2, add(mul(p0, 1 / 3), mul(p3, 2 / 3)));
      // d/dP of -smooth * (|r1|^2 + |r2|^2)
      const k = -2 * o.smooth;
      const terms: [number, Pt][] = [
        [q[1], mul(r1, k)],
        [q[2], mul(r2, k)],
        [q[0], add(mul(r1, (-2 / 3) * k), mul(r2, (-1 / 3) * k))],
        [q[3], add(mul(r1, (-1 / 3) * k), mul(r2, (-2 / 3) * k))],
      ];
      for (const [i, t] of terms) {
        g[i]![0] += t[0];
        g[i]![1] += t[1];
      }
    }
    pts.forEach((p, i) => {
      let m = mul(g[i]!, o.rate);
      const l = len(m);
      if (!Number.isFinite(l)) return;
      if (l > 1) m = mul(m, 1 / l);
      p[0] += m[0];
      p[1] += m[1];
    });
    for (const [hi, j, ho] of joints) {
      const p = pts[j]!;
      const a = len(sub(p, pts[hi]!));
      const b = len(sub(pts[ho]!, p));
      const d = unit(sub(pts[ho]!, pts[hi]!), [0, 0]);
      if (len(d) === 0) continue;
      pts[hi] = [p[0] - d[0] * a, p[1] - d[1] * a];
      pts[ho] = [p[0] + d[0] * b, p[1] + d[1] * b];
    }
  }
  return idx.map((q) => q.map((i) => [...pts[i]!] as Pt) as unknown as Cubic);
}
