// Line styles: 'even' keeps stroked polylines; 'brush' and 'hand' turn each line into a filled outline
// whose width swells and tapers. Lines are first rejoined into strands across the tile edges, so only
// real ends taper and the seams never pinch.
import { simplify } from '../simplify.ts';
import { strands } from './interlace.ts';
import { TAU, type Poly, type Pt } from './util.ts';

export type LineStyle = 'even' | 'brush' | 'hand';

export interface BrushOptions {
  width: number;
  style: 'brush' | 'hand';
  rnd: () => number;
  swell?: number;
  wobble?: number;
}

// One strand unrolled into the plane. closed: a loop on the torus, `pts` is one period and the
// line continues at pts[0] + shift. base: the centreline before the hand wobble.
export interface Centreline {
  base: Pt[];
  pts: Pt[];
  hw: number[];
  closed: boolean;
  shift: Pt;
}

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

// Pieces jump by whole tiles at the edges: shift each piece back so the strand is one polyline.
function unroll(pieces: Poly[], size: number): Pt[] {
  const out: Pt[] = [];
  let ox = 0;
  let oy = 0;
  for (const piece of pieces) {
    const last = out[out.length - 1];
    const [fx, fy] = piece[0]!;
    if (last) {
      ox = Math.round((last[0] - fx) / size) * size;
      oy = Math.round((last[1] - fy) / size) * size;
    }
    for (const [x, y] of piece.slice(last ? 1 : 0)) out.push([x + ox, y + oy]);
  }
  return out;
}

// Extra points so the width profile can change along long straight segments.
function resample(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [pts[0]!];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / step);
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

// Unit normals at each point (miter direction, length capped at 2 so sharp corners stay bounded).
function normals(pts: Pt[], closed: boolean, shift: Pt): Pt[] {
  const n = pts.length;
  const at = (i: number): Pt => {
    if (i < 0) return closed ? [pts[n - 1]![0] - shift[0], pts[n - 1]![1] - shift[1]] : pts[0]!;
    if (i >= n) return closed ? [pts[0]![0] + shift[0], pts[0]![1] + shift[1]] : pts[n - 1]!;
    return pts[i]!;
  };
  const unit = (a: Pt, b: Pt): Pt => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
  };
  return pts.map((p, i) => {
    const a = i > 0 || closed ? unit(at(i - 1), p) : null;
    const b = i < n - 1 || closed ? unit(p, at(i + 1)) : null;
    if (!a) return b!;
    if (!b) return a;
    const mx = a[0] + b[0];
    const my = a[1] + b[1];
    const l = Math.hypot(mx, my);
    if (l < 1e-9) return a;
    const scale = Math.min(2, 1 / Math.max(0.5, l / 2));
    return [(mx / l) * scale, (my / l) * scale];
  });
}

export function centrelines(polys: Poly[], size: number, o: BrushOptions): Centreline[] {
  const w = o.width;
  const swell = o.swell ?? 1.6;
  const wobble = o.wobble ?? 0.6;
  const hand = o.style === 'hand';
  const out: Centreline[] = [];
  for (const st of strands(polys, size)) {
    let pts = resample(unroll(st.pieces, size), Math.max(0.5, w / 2));
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const shift: Pt = st.closed ? [last[0] - first[0], last[1] - first[1]] : [0, 0];
    if (st.closed) pts = pts.slice(0, -1);
    if (pts.length < 2 && !st.closed) continue;
    const s: number[] = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    const L = st.closed
      ? s[s.length - 1]! + Math.hypot(first[0] + shift[0] - pts[pts.length - 1]![0], first[1] + shift[1] - pts[pts.length - 1]![1])
      : s[s.length - 1]!;
    // Whole cycles per strand, so a loop's profile meets itself without a step.
    const k = Math.max(1, Math.round(L / (12 * w)));
    const [p1, p2, p3, p4] = [o.rnd() * TAU, o.rnd() * TAU, o.rnd() * TAU, o.rnd() * TAU];
    const wave = (t: number) => Math.sin(TAU * k * t + p1) * 0.65 + Math.sin(TAU * (2 * k + 1) * t + p2) * 0.35;
    const base = pts;
    if (hand) {
      // Low-frequency wobble, |noise| <= 1, zero at real ends so joints stay put.
      const kw = Math.max(1, Math.round(L / (15 * w)));
      const nm = normals(pts, st.closed, shift);
      pts = pts.map((p, i) => {
        const t = s[i]! / L;
        const env = st.closed ? 1 : smooth(s[i]! / (2 * w)) * smooth((L - s[i]!) / (2 * w));
        const d = wobble * env * (Math.sin(TAU * kw * t + p3) * 0.7 + Math.sin(TAU * (2 * kw + 1) * t + p4) * 0.3);
        return [p[0] + d * nm[i]![0], p[1] + d * nm[i]![1]];
      });
    }
    // Brush tapers to 15 % over 4 widths; hand tapers more gently.
    const [tipMin, tipLen] = hand ? [0.4, 3 * w] : [0.15, 4 * w];
    const amp = (swell - 1) * Math.min(1, L / (20 * w));
    const hw = s.map((si) => {
      if (st.closed) return (w / 2) * (1 + (swell - 1) * (0.5 + 0.5 * wave(si / L)));
      const taper = tipMin + (1 - tipMin) * smooth(Math.min(si, L - si) / tipLen);
      // One swell over the stroke, peaking mid-way, lightly modulated by the seeded wave.
      const bump = Math.sin((Math.PI * si) / L) * (0.85 + 0.15 * wave(si / L));
      return (w / 2) * taper * (1 + amp * bump * taper);
    });
    out.push({ base, pts, hw, closed: st.closed, shift });
  }
  return out;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

function offset(pts: Pt[], hw: number[], nm: Pt[], side: 1 | -1): Pt[] {
  return pts.map((p, i) => [p[0] + side * hw[i]! * nm[i]![0], p[1] + side * hw[i]! * nm[i]![1]]);
}

// Half circle around c from angle a, turning by -pi (from the left side round the tip to the right).
function cap(c: Pt, r: number, a: number): Pt[] {
  const n = Math.max(4, Math.ceil(r * 3));
  const out: Pt[] = [];
  for (let k = 1; k < n; k++) {
    const t = a - (Math.PI * k) / n;
    out.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]);
  }
  return out;
}

function outline(c: Centreline): Pt[] {
  const { closed, shift } = c;
  let { pts, hw } = c;
  if (closed && (shift[0] !== 0 || shift[1] !== 0)) {
    // A loop that winds round the torus is an endless strip: one period with butt ends, lengthened
    // by a few points each way so it overlaps its own shifted copies at the joints.
    const n = pts.length;
    const m = Math.min(n, 8);
    const at = (i: number): Pt => {
      const k = Math.floor(i / n);
      const p = pts[i - k * n]!;
      return [p[0] + k * shift[0], p[1] + k * shift[1]];
    };
    const idx = Array.from({ length: n + 1 + 2 * m }, (_, i) => i - m);
    pts = idx.map(at);
    hw = idx.map((i) => c.hw[((i % n) + n) % n]!);
    const nm = normals(pts, false, shift);
    return [...offset(pts, hw, nm, 1), ...offset(pts, hw, nm, -1).reverse()];
  }
  const nm = normals(pts, closed, shift);
  const left = offset(pts, hw, nm, 1);
  const right = offset(pts, hw, nm, -1).reverse();
  // Ring: both loops in one polygon via a zero-width bridge; nonzero fill keeps the hole.
  if (closed) return [...left, left[0]!, right[right.length - 1]!, ...right];
  const ne = nm[nm.length - 1]!;
  const n0 = nm[0]!;
  const end = cap(pts[pts.length - 1]!, hw[hw.length - 1]!, Math.atan2(ne[1], ne[0]));
  return [...left, ...end, ...right, ...cap(pts[0]!, hw[0]!, Math.atan2(-n0[1], -n0[0]))];
}

// Closed outlines to FILL with the nonzero rule (they overlap at crossings and between copies).
export function brushOutlines(polys: Poly[], size: number, o: BrushOptions): Poly[] {
  const out: Poly[] = [];
  for (const c of centrelines(polys, size, o)) {
    const shape = simplify(outline(c), 0.1);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const [x, y] of shape) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    // A copy for every tile shift that lands on the tile, cut to the tile.
    for (let i = Math.ceil(-x1 / size); i <= Math.floor((size - x0) / size); i++)
      for (let j = Math.ceil(-y1 / size); j <= Math.floor((size - y0) / size); j++) {
        const cut = clipToTile(
          shape.map(([x, y]): Pt => [x + i * size, y + j * size]),
          size,
        );
        if (cut.length >= 3) out.push(cut.map(([x, y]): Pt => [r1(x), r1(y)]));
      }
  }
  return out;
}

// Sutherland-Hodgman against the four tile edges. A concave shape cut in two keeps a zero-width
// seam along the edge; that adds no area to a fill.
function clipToTile(poly: Pt[], size: number): Pt[] {
  let cur = poly;
  for (const [axis, edge, sign] of [
    [0, 0, 1],
    [0, size, -1],
    [1, 0, 1],
    [1, size, -1],
  ] as const) {
    const keep = (v: number) => sign * (v - edge) >= 0;
    const next: Pt[] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i]!;
      const b = cur[(i + 1) % cur.length]!;
      const ina = keep(a[axis]);
      const inb = keep(b[axis]);
      if (ina) next.push(a);
      if (ina !== inb) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    cur = next;
    if (!cur.length) break;
  }
  return cur;
}
