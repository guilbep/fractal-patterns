// Keep clear of the lines: each accent shape that touches a base stroke moves to the nearest spot where it does not.
// Pure and deterministic. The tile repeats, so every distance wraps.
//
// A shape is clear when its outline keeps strokeWidth / 2 + gap from every base segment and no base segment lies
// inside it. A blocked shape tries offsets on rings around its place (radius 1, 2, ... px up to maxShift, 4k points
// per ring so the axes are always tried), clamped so the shape stays whole in the tile, and takes the nearest one
// that is clear and also keeps gap from the shapes already placed. With no clear spot it takes the best one found.
// Base segments sit in a uniform grid (spatial hash) with wrapped cells, so a query costs the segments near it only.
import type { Poly, Pt } from './patterns/util.ts';

export interface KeepClearOptions {
  readonly size: number;
  readonly height?: number;
  readonly strokeWidth: number;
  readonly gap?: number; // px, default 1
  readonly maxShift?: number; // px, default half the distance to the nearest shape, or 25 % of the tile when alone
}

type Seg = readonly [number, number, number, number]; // x0, y0, x1, y1
type Box = readonly [number, number, number, number]; // x0, y0, x1, y1
const EPS = 1e-9;

function pointSeg(px: number, py: number, s: Seg): number {
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((px - s[0]) * dx + (py - s[1]) * dy) / l));
  return Math.hypot(px - s[0] - t * dx, py - s[1] - t * dy);
}

const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

function segSeg(a: Seg, b: Seg): number {
  const d1 = cross(a[0], a[1], a[2], a[3], b[0], b[1]);
  const d2 = cross(a[0], a[1], a[2], a[3], b[2], b[3]);
  const d3 = cross(b[0], b[1], b[2], b[3], a[0], a[1]);
  const d4 = cross(b[0], b[1], b[2], b[3], a[2], a[3]);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(pointSeg(a[0], a[1], b), pointSeg(a[2], a[3], b), pointSeg(b[0], b[1], a), pointSeg(b[2], b[3], a));
}

// Even-odd, so a ring's hole counts as outside.
function inside(x: number, y: number, segs: readonly Seg[]): boolean {
  let c = false;
  for (const s of segs) if (s[1] > y !== s[3] > y && x < s[0] + ((y - s[1]) * (s[2] - s[0])) / (s[3] - s[1])) c = !c;
  return c;
}

const segsOf = (p: readonly Pt[]): Seg[] => p.slice(1).map((v, i): Seg => [p[i]![0], p[i]![1], v[0], v[1]]);
const move = (s: readonly Seg[], dx: number, dy: number): Seg[] => s.map((v): Seg => [v[0] + dx, v[1] + dy, v[2] + dx, v[3] + dy]);
const boxOf = (s: readonly Seg[]): Box => {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const v of s) {
    x0 = Math.min(x0, v[0], v[2]);
    y0 = Math.min(y0, v[1], v[3]);
    x1 = Math.max(x1, v[0], v[2]);
    y1 = Math.max(y1, v[1], v[3]);
  }
  return [x0, y0, x1, y1];
};
const apart = (a: Box, b: Box, m: number) => a[0] > b[2] + m || b[0] > a[2] + m || a[1] > b[3] + m || b[1] > a[3] + m;

// The smallest distance between two outlines-or-lines; 0 when one lies inside the closed outline `shape`.
function dist(shape: readonly Seg[], shapeBox: Box, other: readonly Seg[], otherClosed: boolean, stop: number): number {
  let d = Infinity;
  for (const o of other) {
    for (const s of shape) {
      d = Math.min(d, segSeg(s, o));
      if (d <= stop) return d;
    }
  }
  const o = other[0]!;
  if (o[0] >= shapeBox[0] && o[0] <= shapeBox[2] && o[1] >= shapeBox[1] && o[1] <= shapeBox[3] && inside(o[0], o[1], shape)) return 0;
  if (otherClosed && inside(shape[0]![0], shape[0]![1], other)) return 0;
  return d;
}

// Base segments in a uniform grid over the tile, cells about 4 px. Each entry remembers the unwrapped cell it went
// in, so a query in any copy of the tile gets the segment shifted by whole tiles to its own side.
function grid(base: readonly Poly[], w: number, h: number) {
  const nx = Math.max(1, Math.min(128, Math.round(w / 4)));
  const ny = Math.max(1, Math.min(128, Math.round(h / 4)));
  const cw = w / nx;
  const ch = h / ny;
  const segs: Seg[] = base.flatMap(segsOf);
  const cells: number[][] = Array.from({ length: nx * ny }, () => []); // triples: segment, i, j
  const mod = (a: number, n: number) => ((a % n) + n) % n;
  segs.forEach((s, k) => {
    const [x0, y0, x1, y1] = boxOf([s]);
    for (let j = Math.floor(y0 / ch); j <= Math.floor(y1 / ch); j++)
      for (let i = Math.floor(x0 / cw); i <= Math.floor(x1 / cw); i++) cells[mod(j, ny) * nx + mod(i, nx)]!.push(k, i, j);
  });
  const seen = new Int32Array(segs.length).fill(-1);
  let query = 0;
  // Calls `fn` on each segment (wrapped) in the cells that `b` meets, until it returns true. A segment met twice
  // in one query is skipped; ponytail: a tile so small that one query meets two copies of a segment skips the second.
  return (b: Box, fn: (s: Seg) => boolean): void => {
    query++;
    for (let j = Math.floor(b[1] / ch); j <= Math.floor(b[3] / ch); j++)
      for (let i = Math.floor(b[0] / cw); i <= Math.floor(b[2] / cw); i++) {
        const cell = cells[mod(j, ny) * nx + mod(i, nx)]!;
        for (let e = 0; e < cell.length; e += 3) {
          const k = cell[e]!;
          if (seen[k] === query) continue;
          seen[k] = query;
          const dx = ((i - cell[e + 1]!) / nx) * w;
          const dy = ((j - cell[e + 2]!) / ny) * h;
          const s = segs[k]!;
          if (fn([s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy])) return;
        }
      }
  };
}

const centroid = (p: readonly Pt[]): Pt => {
  const q = p.slice(0, -1);
  return [q.reduce((s, v) => s + v[0], 0) / q.length, q.reduce((s, v) => s + v[1], 0) / q.length];
};

export function keepClear(shapes: Poly[], base: Poly[], o: KeepClearOptions): Poly[] {
  const w = o.size;
  const h = o.height ?? o.size;
  const gap = o.gap ?? 1;
  const need = o.strokeWidth / 2 + gap;
  const near = grid(base, w, h);
  const wrapD = (a: number, b: number, n: number) => Math.min(Math.abs(a - b), n - Math.abs(a - b));
  const centers = shapes.map(centroid);
  const out: Poly[] = shapes.slice();
  const placed: { segs: Seg[]; box: Box }[] = shapes.map((p) => {
    const segs = segsOf(p);
    return { segs, box: boxOf(segs) };
  });

  // A shape's outer radius and, when its box center is inside it, inner radius (else 0), around that center.
  const radii = (segs: readonly Seg[], b: Box): [number, number] => {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    const rOut = Math.max(...segs.map((v) => Math.hypot(v[0] - cx, v[1] - cy)));
    const rIn = inside(cx, cy, segs) ? Math.min(...segs.map((v) => pointSeg(cx, cy, v))) : 0;
    return [rOut, rIn];
  };
  // Base clearance minus need (Infinity past need), with an early stop once below `stop`. One point test against the
  // box center sorts most lines: past rOut + need it cannot touch the shape, within rIn it crosses the inside.
  const baseScore = (segs: readonly Seg[], b: Box, [rOut, rIn]: [number, number], stop: number): number => {
    const cx = (b[0] + b[2]) / 2;
    const cy = (b[1] + b[3]) / 2;
    // First the cheap test on every line, so a line through the inside ends it before any exact distance.
    const close: Seg[] = [];
    let hit = false;
    near([b[0] - need, b[1] - need, b[2] + need, b[3] + need], (l) => {
      const c = pointSeg(cx, cy, l);
      if (c < rIn) return (hit = true);
      if (c - rOut < need) close.push(l);
      return false;
    });
    if (hit) return -need;
    let d = Infinity;
    for (const l of close) {
      d = Math.min(d, dist(segs, b, [l], false, need + stop) - need);
      if (d < stop) break;
    }
    return d;
  };

  const blocked = shapes.map((_, k) => {
    const b = placed[k]!.box;
    return baseScore(placed[k]!.segs, b, radii(placed[k]!.segs, b), 0) < -EPS;
  });

  for (let k = 0; k < shapes.length; k++) {
    if (!blocked[k]) continue;
    const c = centers[k]!;
    let nearest = Infinity;
    centers.forEach((v, j) => {
      if (j !== k) nearest = Math.min(nearest, Math.hypot(wrapD(v[0], c[0], w), wrapD(v[1], c[1], h)));
    });
    const maxShift = o.maxShift ?? (nearest < Infinity ? nearest / 2 : 0.25 * Math.min(w, h));
    const { segs, box } = placed[k]!;
    const form = radii(segs, box);
    const m = maxShift + need + 1;
    // Other shapes that stay put or are placed already, with their wrapped copies near this one.
    const others: { segs: Seg[]; box: Box }[] = [];
    for (let j = 0; j < shapes.length; j++) {
      if (j === k || (j > k && blocked[j])) continue;
      for (const ty of [-h, 0, h])
        for (const tx of [-w, 0, w]) {
          const ob: Box = [placed[j]!.box[0] + tx, placed[j]!.box[1] + ty, placed[j]!.box[2] + tx, placed[j]!.box[3] + ty];
          if (!apart(ob, box, m + gap)) others.push({ segs: move(placed[j]!.segs, tx, ty), box: ob });
        }
    }
    const score = (dx: number, dy: number, stop: number): number => {
      const s = move(segs, dx, dy);
      const b: Box = [box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy];
      let d = baseScore(s, b, form, stop);
      for (const ot of others) {
        if (d < stop) break;
        if (apart(ot.box, b, gap)) continue;
        d = Math.min(d, dist(s, b, ot.segs, true, gap + stop) - gap);
      }
      return d;
    };
    // Clamp so the shape stays whole in the tile.
    const clampX = (dx: number) => Math.min(w - box[2], Math.max(-box[0], dx));
    const clampY = (dy: number) => Math.min(h - box[3], Math.max(-box[1], dy));
    let best: [number, number] = [clampX(0), clampY(0)];
    let bestS = score(best[0], best[1], -Infinity);
    let found = bestS >= -EPS;
    for (let r = 1; r <= maxShift + EPS && !found; r++) {
      const n = 4 * Math.ceil((2 * Math.PI * r) / 4);
      let ringBest: [number, number] | null = null;
      let ringD = Infinity;
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n;
        const dx = clampX(r * Math.cos(a));
        const dy = clampY(r * Math.sin(a));
        const s = score(dx, dy, bestS + EPS); // only a strictly better score matters
        if (s >= -EPS) {
          const len = Math.hypot(dx, dy);
          if (len < ringD) [ringBest, ringD] = [[dx, dy], len];
        } else if (s > bestS + EPS) [best, bestS] = [[dx, dy], s];
      }
      if (ringBest) [best, found] = [ringBest, true];
    }
    const [dx, dy] = best;
    if (dx !== 0 || dy !== 0) {
      out[k] = shapes[k]!.map(([x, y]): Pt => [x + dx, y + dy]);
      placed[k] = { segs: move(segs, dx, dy), box: [box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy] };
    }
  }
  return out;
}
