// Family 'fractal': recursive constructions.
import { fit, place, wrap, type Poly, type Pt, type Rng } from './util.ts';

// 3x3 subdivision: the centre cell and seeded others become square holes (inset outlines),
// the remaining cells recurse.
export function carpet(rnd: Rng, depth: number, size: number): Poly[] {
  const out: Poly[] = [];
  const pHole = 0.1 + 0.3 * rnd();
  const go = (x: number, y: number, s: number, level: number): void => {
    const c = s / 3;
    for (let i = 0; i < 9; i++) {
      const cx = x + (i % 3) * c;
      const cy = y + Math.floor(i / 3) * c;
      if (i === 4 || rnd() < pHole) {
        const k = c * (0.08 + 0.12 * rnd());
        const a = cx + k;
        const b = cy + k;
        const e = c - 2 * k;
        out.push([[a, b], [a + e, b], [a + e, b + e], [a, b + e], [a, b]]);
      } else if (level < depth) go(cx, cy, c, level + 1);
    }
  };
  go(0, 0, 1, 1);
  return place(out, size, 0.03);
}

// Random quadtree: every split cell draws a cross; split chance is seeded per tile and per cell.
// The tile border is drawn too (on both opposite edges), so crosses that reach an edge meet a line.
export function quadtree(rnd: Rng, depth: number, size: number): Poly[] {
  const out: Poly[] = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
  const pSplit = 0.5 + 0.25 * rnd();
  const go = (x: number, y: number, w: number, h: number, level: number): void => {
    // Seeded off-centre split point.
    const sx = w * (0.35 + 0.3 * rnd());
    const sy = h * (0.35 + 0.3 * rnd());
    out.push([[x + sx, y], [x + sx, y + h]], [[x, y + sy], [x + w, y + sy]]);
    if (level >= depth) return;
    for (const [cx, cy, cw, ch] of [[x, y, sx, sy], [x + sx, y, w - sx, sy], [x, y + sy, sx, h - sy], [x + sx, y + sy, w - sx, h - sy]] as const) {
      if (rnd() < pSplit) go(cx, cy, cw, ch, level + 1);
    }
  };
  go(0, 0, 1, 1, 1);
  return place(out, size, 0);
}

// Binary tree: each branch forks into two with seeded spread angles and length ratios.
// One polyline per leaf: the first child continues the parent's polyline.
export function tree(rnd: Rng, depth: number, size: number): Poly[] {
  const out: Poly[] = [];
  const spread = 0.25 + 0.45 * rnd();
  const ratio = 0.62 + 0.14 * rnd();
  const go = (poly: Poly, x: number, y: number, ang: number, len: number, level: number): void => {
    const nx = x + Math.cos(ang) * len;
    const ny = y + Math.sin(ang) * len;
    poly.push([nx, ny]);
    if (level >= depth) return;
    const jitter = () => 0.7 + 0.6 * rnd();
    go(poly, nx, ny, ang - spread * jitter(), len * ratio * jitter(), level + 1);
    const branch: Poly = [[nx, ny]];
    out.push(branch);
    go(branch, nx, ny, ang + spread * jitter(), len * ratio * jitter(), level + 1);
  };
  const trunk: Poly = [[0, 0]];
  out.push(trunk);
  go(trunk, 0, 0, -Math.PI / 2, 1, 1);
  return fit(out, size, 0.06);
}

// Generalized paperfolding curve (dragon family) with 2^depth unit steps on a square grid:
// the fold direction of each level comes from the seed, and every corner is cut by a seeded
// chamfer, so the curve never touches itself at grid vertices.
export function fold(rnd: Rng, depth: number, size: number): Poly[] {
  const cut = 0.15 + 0.2 * rnd();
  const bits = Array.from({ length: depth }, () => rnd() < 0.5);
  const steps = 1 << depth;
  let x = 0;
  let y = 0;
  let dir = 0; // 0 right, 1 down, 2 left, 3 up
  const poly: Poly = [[0, 0]];
  for (let n = 1; n <= steps; n++) {
    const dx = [1, 0, -1, 0][dir] ?? 0;
    const dy = [0, 1, 0, -1][dir] ?? 0;
    x += dx;
    y += dy;
    if (n === steps) {
      poly.push([x, y]);
      break;
    }
    const k = 31 - Math.clz32(n & -n);
    const left = (bits[k] ?? false) !== (((n >> (k + 1)) & 1) === 1);
    dir = (dir + (left ? 3 : 1)) % 4;
    const ex = [1, 0, -1, 0][dir] ?? 0;
    const ey = [0, 1, 0, -1][dir] ?? 0;
    poly.push([x - dx * cut, y - dy * cut], [x + ex * cut, y + ey * cut]);
  }
  return fit([poly], size, 0.06);
}

// Hilbert curve of order depth through the cell centres of a 2^depth grid. Its two ends are
// extended to the tile edge at the same height, so the curve runs on into the next tile; half a
// cell of border keeps neighbour tiles one cell apart. Seed: one of the 8 symmetries of the square,
// which 2x2 sub-quadrants are left out, corner chamfer or rounding, and per top-level quadrant
// whether its corners are cut.
export function hilbert(rnd: Rng, depth: number, size: number): Poly[] {
  const n = 1 << depth;
  const sym = Math.floor(rnd() * 8);
  const cut = 0.2 + 0.2 * rnd();
  const round = rnd() < 0.5;
  const cutQuad = [0, 1, 2, 3].map(() => rnd() < 0.7);
  const cells: Pt[] = [];
  for (let d = 0; d < n * n; d++) {
    let x = 0;
    let y = 0;
    let t = d;
    for (let s = 1; s < n; s *= 2) {
      const rx = 1 & (t >> 1);
      const ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t >>= 2;
    }
    cells.push([x + 0.5, y + 0.5]);
  }
  // Left-out sub-quadrants: a 2x2 block's U turn (cells 4b..4b+3) is cut short from its first cell
  // to its last, which are neighbours, so the curve stays connected and leaves a small notch.
  const pOmit = depth > 1 ? 0.1 + 0.35 * rnd() : 0;
  const omit = Array.from({ length: (n * n) / 4 }, () => rnd() < pOmit);
  const kept = cells.filter((_, d) => !(omit[d >> 2] && (d & 3) % 3 !== 0));
  const pts: Pt[] = [[0, 0.5], ...kept, [n, 0.5]];
  const poly: Poly = [[0, 0.5]];
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [px, py] = pts[i]!;
    const [bx, by] = pts[i + 1]!;
    const quad = (px < n / 2 ? 0 : 1) + (py < n / 2 ? 0 : 2);
    if ((ax - px) * (by - py) === (ay - py) * (bx - px) || !cutQuad[quad]) {
      poly.push([px, py]);
      continue;
    }
    const a: Pt = [px + (ax - px) * cut, py + (ay - py) * cut];
    const b: Pt = [px + (bx - px) * cut, py + (by - py) * cut];
    if (round) poly.push(a, [(a[0] + b[0]) / 4 + px / 2, (a[1] + b[1]) / 4 + py / 2], b);
    else poly.push(a, b);
  }
  poly.push([n, 0.5]);
  const unit = poly.map(([x, y]): Pt => {
    let u = x / n;
    let v = y / n;
    if (sym & 4) [u, v] = [v, u];
    if (sym & 1) u = 1 - u;
    if (sym & 2) v = 1 - v;
    return [u, v];
  });
  return place([unit], size, 0);
}

// Square lattice whose edges are random Koch curves: each iteration replaces every segment by
// four, with a triangular bump in its middle third. Seed: bump height and, per segment, whether
// the bump goes to one side or the other. The tile draws its top and left edges; wrap() puts the
// bumps that cross the border into the neighbour tile.
export function koch(rnd: Rng, depth: number, size: number): Poly[] {
  const height = (0.55 + 0.4 * rnd()) * (Math.sqrt(3) / 2);
  const bias = 0.25 + 0.5 * rnd();
  const edge = (a: Pt, b: Pt): Poly => {
    let poly: Poly = [a, b];
    for (let level = 0; level < depth; level++) {
      const next: Poly = [a];
      for (let i = 1; i < poly.length; i++) {
        const [x0, y0] = poly[i - 1]!;
        const [x1, y1] = poly[i]!;
        const dx = (x1 - x0) / 3;
        const dy = (y1 - y0) / 3;
        const side = rnd() < bias ? 1 : -1;
        const mx = x0 + 1.5 * dx - side * height * dy;
        const my = y0 + 1.5 * dy + side * height * dx;
        next.push([x0 + dx, y0 + dy], [mx, my], [x0 + 2 * dx, y0 + 2 * dy], [x1, y1]);
      }
      poly = next;
    }
    return poly;
  };
  return wrap([edge([0, 0], [size, 0]), edge([0, 0], [0, size])], size);
}

// Sierpinski triangles on the two halves of the tile (split by a seeded diagonal, seeded quarter turn): each triangle
// draws its midpoint triangle, then its corner triangles recurse with a seeded chance or get a
// small inner triangle (the first level always recurses). The tile border is drawn on all four edges, so neighbours match.
export function sierpinski(rnd: Rng, depth: number, size: number): Poly[] {
  const flip = rnd() < 0.5;
  const turns = Math.floor(rnd() * 4);
  const pRecurse = 0.7 + 0.3 * rnd();
  const pDetail = 0.3 + 0.6 * rnd();
  const inset = 0.3 + 0.25 * rnd();
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out: Poly[] = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], flip ? [[1, 0], [0, 1]] : [[0, 0], [1, 1]]];
  const go = (a: Pt, b: Pt, c: Pt, level: number): void => {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    out.push([ab, bc, ca, ab]);
    if (level >= depth) return;
    for (const [p, q, r] of [[a, ab, ca], [ab, b, bc], [ca, bc, c]] as const) {
      if (level < 2 || rnd() < pRecurse) go(p, q, r, level + 1);
      else if (rnd() < pDetail) {
        const gx = (p[0] + q[0] + r[0]) / 3;
        const gy = (p[1] + q[1] + r[1]) / 3;
        const s = (v: Pt): Pt => [gx + (v[0] - gx) * inset, gy + (v[1] - gy) * inset];
        out.push([s(p), s(q), s(r), s(p)]);
      }
    }
  };
  if (flip) {
    go([0, 0], [1, 0], [0, 1], 1);
    go([1, 1], [0, 1], [1, 0], 1);
  } else {
    go([0, 0], [1, 0], [1, 1], 1);
    go([0, 0], [0, 1], [1, 1], 1);
  }
  // Seeded quarter turns about the tile centre (orientation of the triangles).
  const rot = (poly: Poly): Poly => poly.map((p) => {
    let [x, y] = p;
    for (let i = 0; i < turns; i++) [x, y] = [1 - y, x];
    return [x, y];
  });
  return place(out.map(rot), size, 0);
}

// H-tree: a segment, then a perpendicular segment centred on each of its ends, depth levels deep.
// Seed: length ratio between levels and a per-branch length jitter. Each axis is scaled on its own
// to fill the tile up to a margin, so neighbour tiles sit as close as the tree's own branches.
// Every end point forks into two half-segments; the first continues the current polyline.
export function htree(rnd: Rng, depth: number, size: number): Poly[] {
  const ratio = 0.64 + 0.07 * rnd();
  const jitter = 0.25 * rnd();
  const out: Poly[] = [];
  const go = (poly: Poly, x: number, y: number, horizontal: boolean, half: number, level: number): void => {
    for (const sign of [-1, 1]) {
      const h = half * (1 + jitter * (2 * rnd() - 1));
      const nx = horizontal ? x + sign * h : x;
      const ny = horizontal ? y : y + sign * h;
      const branch: Poly = sign < 0 ? poly : [[x, y]];
      if (sign > 0) out.push(branch);
      branch.push([nx, ny]);
      if (level < depth) go(branch, nx, ny, !horizontal, half * ratio, level + 1);
    }
  };
  const root: Poly = [[0, 0]];
  out.push(root);
  go(root, 0, 0, true, 1, 1);
  const m = 0.04 * size;
  const span = (i: 0 | 1) => {
    const vs = out.flat().map((p) => p[i]);
    const lo = Math.min(...vs);
    const w = Math.max(...vs) - lo;
    return (v: number) => (w > 1e-9 ? m + ((v - lo) / w) * (size - 2 * m) : size / 2);
  };
  const sx = span(0);
  const sy = span(1);
  return out.map((poly) => poly.map(([x, y]): Pt => [sx(x), sy(y)]));
}
