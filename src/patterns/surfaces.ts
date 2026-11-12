// Family 'surface': masonry and paving bonds drawn as an outline hatch. Every unit is a closed
// rectangle; units are generated once per lattice period and wrap() carries the ones that cross
// the tile edge to the opposite side. The lattice is offset by a fraction of a unit, so no joint
// lies on the tile border (it would be drawn by both neighbouring tiles).
import { TAU, thin, wrap, type Poly, type Pt, type Rng } from './util.ts';

const rect = (x: number, y: number, w: number, h: number): Poly => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
  [x, y],
];

// n courses of m units across the tile; course i is shifted by (i / q) of a unit.
// Seeded joints are dropped (two units merge) or added (a unit splits into two headers).
function courses(rnd: Rng, size: number, n: number, m: number, q: number, pMerge: number, pSplit: number): Poly[] {
  const h = size / n;
  const len = size / m;
  const sx = len / (4 * q); // never a multiple of len, also for the half-unit header joints
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = ((i % q) / q) * len + sx;
    const y = i * h + h / 4;
    for (let j = 0; j < m; j++) {
      const x = x0 + j * len;
      if (j < m - 1 && rnd() < pMerge) {
        out.push(rect(x, y, 2 * len, h));
        j++;
      } else if (rnd() < pSplit) out.push(rect(x, y, len / 2, h), rect(x + len / 2, y, len / 2, h));
      else out.push(rect(x, y, len, h));
    }
  }
  return out;
}

// Running bond: courses offset by half, a third or a quarter of a brick. The course count is a
// multiple of that bond's period, so the offsets repeat across the tile. Seed: aspect, bond,
// a few missing joints (long units) and header bricks (half units).
export function brick(rnd: Rng, depth: number, size: number): Poly[] {
  const aspect = 2 + rnd();
  const q = 2 + Math.floor(rnd() * 3);
  const n = q * Math.ceil((3 * depth) / q);
  const m = Math.max(1, Math.round(n / aspect));
  return wrap(courses(rnd, size, n, m, q, 0.04 + 0.06 * rnd(), 0.04 + 0.06 * rnd()), size);
}

// Stack bond: an aligned grid. Seed: aspect, horizontal or vertical units, merged pairs.
export function stack(rnd: Rng, depth: number, size: number): Poly[] {
  const aspect = 1.5 + 1.5 * rnd();
  const vertical = rnd() < 0.5;
  const n = 3 * depth;
  const m = Math.max(1, Math.round(n / aspect));
  const polys = wrap(courses(rnd, size, n, m, 1, 0.06 + 0.1 * rnd(), 0), size);
  return vertical ? polys.map((p) => p.map(([x, y]): Pt => [y, x])) : polys;
}

// 90 degree herringbone, in brick widths: horizontal brick k at [k, k+r] x [k, k+1], vertical
// brick k at [k, k+1] x [k+1, k+1+r] form a zigzag strip; strips repeat by (r, -r). The lattice
// spanned by (1, 1) and (r, -r) contains (2rk, 0) and (0, 2rk) when axis-aligned, and is the
// rectangle sqrt2 x sqrt2*r when turned 45 degrees, so the brick width is chosen to fit k periods.
// Each brick is kept once: the copy whose centre lies in the tile. Seed: r = 2, 3 or 4, the
// orientation, and the phase of the lattice.
export function herringbone(rnd: Rng, depth: number, size: number): Poly[] {
  const r = 2 + Math.floor(rnd() * 3);
  const diag = rnd() < 0.5;
  const w = diag ? size / (Math.SQRT2 * r * depth) : size / (2 * r * depth);
  const px = (0.1 + 0.8 * rnd()) * w;
  const py = (0.1 + 0.8 * rnd()) * w;
  const map = ([x, y]: Pt): Pt => (diag ? [((x + y) / Math.SQRT2) * w + px, ((y - x) / Math.SQRT2) * w + py] : [x * w + px, y * w + py]);
  const out: Poly[] = [];
  for (let a = -2; a <= 2 * r * depth + 2; a++) {
    for (let b = -depth - 2; b <= depth + 2; b++) {
      const ox = a + b * r;
      const oy = a - b * r;
      for (const unit of [rect(ox, oy, r, 1), rect(ox, oy + 1, 1, r)]) {
        const pts = unit.map(map);
        const cx = (pts[0]![0] + pts[2]![0]) / 2;
        const cy = (pts[0]![1] + pts[2]![1]) / 2;
        if (cx >= 0 && cx < size && cy >= 0 && cy < size) out.push(pts);
      }
    }
  }
  return wrap(out, size);
}

// Basket weave: 2*depth x 2*depth square cells in a checkerboard of horizontal and vertical
// groups of bars. Seed: bars per cell (2 to 4) and cells that swap orientation.
export function basket(rnd: Rng, depth: number, size: number): Poly[] {
  const bars = 2 + Math.floor(rnd() * 3);
  const pSwap = 0.05 + 0.15 * rnd();
  const n = 2 * depth;
  const c = size / n;
  const t = c / bars;
  const s = t / 4;
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const across = ((i + j) % 2 === 0) !== rnd() < pSwap;
      for (let k = 0; k < bars; k++) {
        out.push(across ? rect(j * c + s, i * c + k * t + s, c, t) : rect(j * c + k * t + s, i * c + s, t, c));
      }
    }
  }
  return wrap(out, size);
}

// Grids and nets. The hexagonal and triangular lattices have a rectangular period with side
// ratio sqrt3, so q periods one way and p the other, with q / p the nearest whole ratio to sqrt3,
// and the short side is stretched by a few percent to fit. Offsets are quarter steps, so no
// axis-parallel line (walls, inner shapes, cross arms) lies on the tile border.

// Breaks a polyline at seeded gaps: point t is joined to t - 1 unless the segment is omitted.
function gapped(out: Poly[], rnd: Rng, n: number, pGap: number, at: (t: number) => Pt): void {
  let run: Poly = [at(0)];
  for (let t = 1; t <= n; t++) {
    if (rnd() < pGap) {
      if (run.length > 1) out.push(run);
      run = [at(t)];
    } else run.push(at(t));
  }
  if (run.length > 1) out.push(run);
}

const swap = (polys: Poly[]): Poly[] => polys.map((p) => p.map(([x, y]): Pt => [y, x]));

// Honeycomb, flat-top: 2m columns of k cells, m = depth + 2, k = round(sqrt3 m), rows stretched
// by sqrt3 m / k. Each cell draws its three walls v0..v3, the other three belong to its
// neighbours. Seed: flat or pointy top, missing walls, inner hexagons at 0.4 scale.
export function hex(rnd: Rng, depth: number, size: number): Poly[] {
  const pointy = rnd() < 0.5;
  const pInner = 0.05 + 0.15 * rnd();
  const pGap = 0.03 + 0.07 * rnd();
  const m = depth + 2;
  const k = Math.round(Math.sqrt(3) * m);
  const R = size / (3 * m);
  const h = size / k;
  const out: Poly[] = [];
  for (let c = 0; c < 2 * m; c++) {
    for (let r = 0; r < k; r++) {
      const cx = c * 1.5 * R + R / 4;
      const cy = (r + (c % 2) / 2) * h + h / 4;
      const v =
        (s: number) =>
        (i: number): Pt => [cx + s * R * Math.cos((i * TAU) / 6), cy + ((s * h) / Math.sqrt(3)) * Math.sin((i * TAU) / 6)];
      gapped(out, rnd, 3, pGap, v(1));
      if (rnd() < pInner) out.push([0, 1, 2, 3, 4, 5, 0].map(v(0.4)));
    }
  }
  const polys = wrap(out, size);
  return pointy ? swap(polys) : polys;
}

// Triangular net: 2k rows of m triangles' bases, k = depth + 2, m = round(sqrt3 k), rows
// stretched by m / (sqrt3 k). Three families of lines, each drawn once per period. Seed:
// orientation, omitted segments, triangles holding their medial (inner) triangle.
export function trinet(rnd: Rng, depth: number, size: number): Poly[] {
  const turn = rnd() < 0.5;
  const pInner = 0.04 + 0.12 * rnd();
  const pGap = 0.03 + 0.07 * rnd();
  const k = depth + 2;
  const m = Math.round(Math.sqrt(3) * k);
  const a = size / m;
  const h = size / (2 * k);
  const pt = (i: number, j: number): Pt => [(i + j / 2) * a + a / 4, j * h + h / 4];
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const out: Poly[] = [];
  for (let j = 0; j < 2 * k; j++) gapped(out, rnd, m, pGap, (t) => pt(t, j));
  for (let i = 0; i < m; i++) {
    gapped(out, rnd, 2 * k, pGap, (t) => pt(i, t));
    gapped(out, rnd, 2 * k, pGap, (t) => pt(i - t, t));
  }
  for (let j = 0; j < 2 * k; j++) {
    for (let i = 0; i < m; i++) {
      for (const [p, q, s] of [
        [pt(i, j), pt(i + 1, j), pt(i, j + 1)],
        [pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)],
      ] as const) {
        if (rnd() < pInner) out.push([mid(p, q), mid(q, s), mid(s, p), mid(p, q)]);
      }
    }
  }
  const polys = wrap(out, size);
  return turn ? swap(polys) : polys;
}

// Nested boxes: depth x depth cells, each holding up to N (1 to 4) concentric squares spaced by
// the inset g (0.1 to 0.12 of a cell); nesting stops before a square gets narrower than g.
// Seeded cells hold diamonds instead, spaced by g measured across their sides.
export function nested(rnd: Rng, depth: number, size: number): Poly[] {
  const c = size / depth;
  const N = 1 + Math.floor(rnd() * 4);
  const g = (0.1 + 0.02 * rnd()) * c;
  const pTurn = 0.1 + 0.2 * rnd();
  const out: Poly[] = [];
  for (let i = 0; i < depth; i++) {
    for (let j = 0; j < depth; j++) {
      const cx = j * c + c / 4 + c / 2;
      const cy = i * c + c / 4 + c / 2;
      out.push(rect(cx - c / 2, cy - c / 2, c, c));
      const turn = rnd() < pTurn;
      for (let l = 1; l <= N; l++) {
        const d = turn ? c / 2 - g - (l - 1) * g * Math.SQRT2 : c / 2 - l * g;
        if (d < g / 2) break;
        out.push(
          turn
            ? [
                [cx + d, cy],
                [cx, cy + d],
                [cx - d, cy],
                [cx, cy - d],
                [cx + d, cy],
              ]
            : rect(cx - d, cy - d, 2 * d, 2 * d),
        );
      }
    }
  }
  return wrap(out, size);
}

// Dot grid: n = 2 depth + 2 rows of n dots, square or staggered by half a cell on odd rows.
// A dot is a closed 8 to 12 segment polygon. Seed: layout, radius, segment count, and cells
// where the dot becomes a larger ring, a cross, or nothing.
export function dots(rnd: Rng, depth: number, size: number): Poly[] {
  const stagger = rnd() < 0.5;
  const n = 2 * depth + 2;
  const c = size / n;
  const r = (0.15 + 0.1 * rnd()) * c;
  const seg = 8 + Math.floor(rnd() * 5);
  const pAlt = 0.06 + 0.12 * rnd();
  const circle = (x: number, y: number, rad: number): Poly =>
    Array.from({ length: seg + 1 }, (_, i): Pt => [
      x + rad * Math.cos((TAU * (i % seg)) / seg),
      y + rad * Math.sin((TAU * (i % seg)) / seg),
    ]);
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = j * c + (3 * c) / 4 + (stagger && i % 2 ? c / 2 : 0);
      const y = i * c + c / 2;
      if (rnd() >= pAlt) out.push(circle(x, y, r));
      else {
        const u = rnd();
        if (u < 1 / 3) out.push(circle(x, y, 1.6 * r));
        else if (u < 2 / 3)
          out.push(
            [
              [x - 1.5 * r, y],
              [x + 1.5 * r, y],
            ],
            [
              [x, y - 1.5 * r],
              [x, y + 1.5 * r],
            ],
          );
      }
    }
  }
  return wrap(out, size);
}

// Hatches and curves. Every line is one full period on the torus (it closes on itself across
// the tile), and wrap() cuts it at the edges, so each strand is drawn once and meets itself.

// Slopes (p, q) whose lines close after p tiles across and q tiles down: 45, 135, 1:2 and 2:1.
const SLOPES: readonly Pt[] = [
  [1, 1],
  [1, -1],
  [1, 2],
  [2, 1],
  [1, -2],
  [2, -1],
];

// The torus line through (x, y) with direction (p, q), as k pieces of which keep(j) are drawn,
// each covering the fraction f of its piece; kept neighbours with f = 1 are merged into one run.
// x is reduced into [0, size) so the period spans at most [-size, 2 size], the reach of wrap().
function torusLine(out: Poly[], x: number, y: number, [p, q]: Pt, size: number, k: number, f: number, keep: (j: number) => boolean): void {
  const x0 = x % size;
  const at = (t: number): Pt => [x0 + (t - 0.5) * p * size, y + (t - 0.5) * q * size];
  let run: Poly | null = null;
  for (let j = 0; j < k; j++) {
    if (!keep(j)) run = null;
    else if (run && f === 1) run[1] = at((j + 1) / k);
    else {
      run = [at(j / k), at((j + f) / k)];
      out.push(run);
    }
  }
}

// Parallel hatch: n lines (an even count) across the tile, about 3 depth per tile width.
// Seed: slope, even or wide-narrow rhythm, dashed lines.
export function hatch(rnd: Rng, depth: number, size: number): Poly[] {
  const d = SLOPES[Math.floor(rnd() * SLOPES.length)]!;
  const r = rnd() < 0.5 ? 0 : 0.25 + 0.15 * rnd();
  const pDash = 0.1 + 0.25 * rnd();
  const len = Math.hypot(d[0], d[1]);
  const n = 2 * Math.max(1, Math.round((1.5 * depth) / len));
  const step = size / (n * Math.abs(d[1])); // spacing of the strands along a horizontal
  const s = (0.1 + 0.3 * rnd()) * step;
  const y = (0.1 + 0.8 * rnd()) * size; // a round value put dash ends on the border
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const x = s + (i + (i % 2) * r) * step;
    if (rnd() < pDash) torusLine(out, x, y, d, size, Math.round(10 * len), 0.6, () => true);
    else torusLine(out, x, y, d, size, 1, 1, () => true);
  }
  return wrap(out, size);
}

// Crosshatch: two families of different slopes, each line cut at about 4 depth pieces per tile
// width, seeded pieces omitted.
export function crosshatch(rnd: Rng, depth: number, size: number): Poly[] {
  const i = Math.floor(rnd() * SLOPES.length);
  const j = (i + 1 + Math.floor(rnd() * (SLOPES.length - 1))) % SLOPES.length;
  const pGap = 0.04 + 0.12 * rnd();
  const out: Poly[] = [];
  for (const d of [SLOPES[i]!, SLOPES[j]!]) {
    const len = Math.hypot(d[0], d[1]);
    const n = Math.max(1, Math.round((2 * depth) / len));
    const step = size / (n * Math.abs(d[1]));
    const s = (0.1 + 0.8 * rnd()) * step;
    const y = (0.1 + 0.8 * rnd()) * size;
    for (let l = 0; l < n; l++) torusLine(out, s + l * step, y, d, size, Math.round(4 * len * depth), 1, () => rnd() >= pGap);
  }
  return wrap(out, size);
}

// Zigzag: n = 2 depth + 2 rows of m chevrons; rows sit at half steps and the amplitude is 0.3 to
// 0.45 of a row, so no corner touches the border. Seed: amplitude, m, orientation, half-shifted rows.
export function zigzag(rnd: Rng, depth: number, size: number): Poly[] {
  const vertical = rnd() < 0.5;
  const n = 2 * depth + 2;
  const h = size / n;
  const amp = (0.3 + 0.15 * rnd()) * h;
  const m = Math.max(2, Math.round(n * (0.5 + 0.7 * rnd())));
  const w = size / m;
  const pShift = 0.15 + 0.3 * rnd();
  const s = (0.1 + 0.3 * rnd()) * w;
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = s + (rnd() < pShift ? w / 2 : 0);
    out.push(Array.from({ length: 2 * m + 1 }, (_, j): Pt => [x0 + (j * w) / 2, (i + 0.5) * h + (j % 2 ? amp : -amp)]));
  }
  const polys = wrap(out, size);
  return vertical ? swap(polys) : polys;
}

// Fish scales: 2m staggered rows of m half circles, m = depth + 2, rows a radius apart. Centres
// sit at a fifth and a third of a step (a quarter would put arc samples on the border), so no arc end or bottom lies on the border. Seed: a
// second concentric arc, orientation, scales with an extra inner arc.
export function scales(rnd: Rng, depth: number, size: number): Poly[] {
  const orient = Math.floor(rnd() * 4);
  const two = rnd() < 0.5;
  const pInner = 0.08 + 0.15 * rnd();
  const m = depth + 2;
  const w = size / m;
  const r = w / 2;
  const arc = (cx: number, cy: number, rad: number): Poly => {
    const k = Math.max(4, Math.ceil((Math.PI * rad) / 2));
    return Array.from({ length: k + 1 }, (_, t): Pt => [cx + rad * Math.cos((Math.PI * t) / k), cy + rad * Math.sin((Math.PI * t) / k)]);
  };
  const out: Poly[] = [];
  for (let i = 0; i < 2 * m; i++) {
    for (let j = 0; j < m; j++) {
      const cx = (j + 0.2 + (i % 2) / 2) * w;
      const cy = (i + 1 / 3) * r;
      out.push(arc(cx, cy, r));
      if (two) out.push(arc(cx, cy, 0.65 * r));
      if (rnd() < pInner) out.push(arc(cx, cy, 0.35 * r));
    }
  }
  const polys = wrap(out, size);
  if (orient === 1) return polys.map((p) => p.map(([x, y]): Pt => [x, size - y]));
  if (orient === 2) return swap(polys);
  if (orient === 3) return swap(polys).map((p) => p.map(([x, y]): Pt => [size - x, y]));
  return polys;
}

// Waves: n = depth + 2 rows of sine curves with k whole periods per tile; the phase steps by
// c / n of a turn per row, so row n meets row 0. Seed: amplitude, k, c, doubled rows.
export function waves(rnd: Rng, depth: number, size: number): Poly[] {
  const n = depth + 2;
  const h = size / n;
  const amp = (0.12 + 0.18 * rnd()) * h;
  const k = 1 + Math.floor(rnd() * 3) + Math.floor(depth / 2);
  const dphi = (TAU * Math.floor(rnd() * 3)) / n;
  const pDouble = 0.1 + 0.25 * rnd();
  const s = rnd() * size;
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const offs = rnd() < pDouble ? [0, 0.3 * h] : [0];
    for (const o of offs) {
      const y0 = (i + 0.4) * h + o;
      const pts = Array.from({ length: 4 * size + 1 }, (_, t): Pt => {
        const x = s + t / 4;
        return [x, y0 + amp * Math.sin((TAU * k * (x - s)) / size + i * dphi)];
      });
      out.push(thin(pts, 2));
    }
  }
  return wrap(out, size);
}
