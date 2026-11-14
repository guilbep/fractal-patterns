// Regions enclosed by the tile lines on the torus, and their colouring.
// The tile square is added as virtual edges, so the arrangement is planar inside [0, size]²;
// pieces on both sides of a virtual edge are then merged, which glues the square into a torus.

import type { Poly, Pt } from './util.ts';

// loops: ccw outer boundaries and cw holes of the face's pieces, in tile coordinates.
// A face that wraps is several pieces (a torus face need not be a disc, so one loop cannot describe it).
export type Face = { loops: Pt[][]; area: number; vertices: number };

type Seg = [number, number, number, number];

export function arrangement(polys: Poly[], size: number, eps = 1e-6): { faces: Face[]; adjacency: number[][] } {
  // Integer grid of step eps * size; the tile is [0, N]².
  const g = eps * size;
  const N = Math.round(size / g);
  const q = (v: number) => Math.min(N, Math.max(0, Math.round(v / g)));
  const segs = dedupe(polys.flatMap((p) => p.slice(1).map((b, i): Seg => [q(p[i]![0]), q(p[i]![1]), q(b[0]), q(b[1])])));
  const real = prune(dedupe(split(segs, N)), N);

  // Real segments on the tile edge become flags on the perimeter edges (stored on the x=0 / y=0 side).
  const onEdge = (s: Seg, k: 0 | 1) => (s[k] === 0 || s[k] === N) && s[k] === s[k + 2];
  const inner = real.filter((s) => !onEdge(s, 0) && !onEdge(s, 1));
  const covered = (k: 0 | 1, a: number, b: number) =>
    real.some((s) => onEdge(s, k) && Math.min(s[1 - k]!, s[3 - k]!) <= a && Math.max(s[1 - k]!, s[3 - k]!) >= b);
  const cuts: [Set<number>, Set<number>] = [new Set([0, N]), new Set([0, N])];
  for (const s of real) {
    for (const [x, y] of [
      [s[0], s[1]],
      [s[2], s[3]],
    ] as const) {
      if (x === 0 || x === N) cuts[0].add(y);
      if (y === 0 || y === N) cuts[1].add(x);
    }
  }

  // Edges: inner real ones, then perimeter pairs (index p on the 0 side, p + 1 on the N side).
  type Edge = { a: number; b: number; real: boolean; twin: number };
  const vid = new Map<string, number>();
  const vx: number[] = [];
  const vy: number[] = [];
  const v = (x: number, y: number) => {
    const key = `${x},${y}`;
    let i = vid.get(key);
    if (i === undefined) {
      i = vx.push(x) - 1;
      vy.push(y);
      vid.set(key, i);
    }
    return i;
  };
  const edges: Edge[] = inner.map((s) => ({ a: v(s[0], s[1]), b: v(s[2], s[3]), real: true, twin: -1 }));
  for (const k of [0, 1] as const) {
    const ts = [...cuts[k]].sort((a, b) => a - b);
    for (let i = 1; i < ts.length; i++) {
      const lo = ts[i - 1]!;
      const hi = ts[i]!;
      const r = covered(k, lo, hi);
      const at = (c: number, t: number) => (k === 0 ? v(c, t) : v(t, c));
      const e = edges.length;
      edges.push({ a: at(0, lo), b: at(0, hi), real: r, twin: e + 1 }, { a: at(N, lo), b: at(N, hi), real: r, twin: e });
    }
  }

  // Half-edges 2e (a -> b) and 2e + 1 (b -> a); next turns clockwise so the face is on the left.
  const from = (h: number) => (h & 1 ? edges[h >> 1]!.b : edges[h >> 1]!.a);
  const to = (h: number) => from(h ^ 1);
  const out: number[][] = vx.map(() => []);
  for (let h = 0; h < 2 * edges.length; h++) out[from(h)]!.push(h);
  const pos = new Int32Array(2 * edges.length);
  for (const hs of out) {
    const ang = (h: number) => Math.atan2(vy[to(h)]! - vy[from(h)]!, vx[to(h)]! - vx[from(h)]!);
    hs.sort((a, b) => ang(a) - ang(b));
    hs.forEach((h, i) => (pos[h] = i));
  }
  const next = (h: number) => {
    const hs = out[to(h)]!;
    return hs[(pos[h ^ 1]! - 1 + hs.length) % hs.length]!;
  };

  // Components of the planar graph, to tell holes from the pieces around them.
  const comp = new UnionFind(vx.length);
  for (const e of edges) comp.union(e.a, e.b);

  const cycleOf = new Int32Array(2 * edges.length).fill(-1);
  const cycles: { hs: number[]; area: number }[] = [];
  for (let h0 = 0; h0 < 2 * edges.length; h0++) {
    if (cycleOf[h0] !== -1) continue;
    const hs: number[] = [];
    let area = 0;
    for (let h = h0; cycleOf[h] === -1; h = next(h)) {
      cycleOf[h] = cycles.length;
      hs.push(h);
      area += vx[from(h)]! * vy[to(h)]! - vx[to(h)]! * vy[from(h)]!;
    }
    cycles.push({ hs, area: area / 2 });
  }

  // Pieces are the ccw cycles; each cw cycle is the outside of the square or a hole in the smallest piece around it.
  const pieceOf = cycles.map((c, i) => (c.area > 0 ? i : -1));
  const rootComp = comp.find(vid.get('0,0')!); // the square's own component
  cycles.forEach((c, i) => {
    if (c.area > 0) return;
    const p = from(c.hs[0]!);
    if (comp.find(p) === rootComp) return; // outside of the square
    let best = -1;
    cycles.forEach((o, j) => {
      if (o.area <= 0 || comp.find(from(o.hs[0]!)) === comp.find(p)) return;
      if ((best === -1 || o.area < cycles[best]!.area) && inside(vx[p]!, vy[p]!, o.hs, from, vx, vy)) best = j;
    });
    pieceOf[i] = best;
  });
  const pieceOfH = (h: number) => pieceOf[cycleOf[h]!]!;
  const inside1 = (e: number) => Math.max(pieceOfH(2 * e), pieceOfH(2 * e + 1));

  // Glue across the virtual edges.
  const glue = new UnionFind(cycles.length);
  edges.forEach((e, i) => e.twin > i && !e.real && glue.union(inside1(i), inside1(e.twin)));
  const faceOfPiece = new Map<number, number>();
  const faces: Face[] = [];
  const faceIdx: number[] = cycles.map(() => -1);
  cycles.forEach((c, i) => {
    const p = pieceOf[i]!;
    if (p < 0) return;
    const r = glue.find(p);
    let f = faceOfPiece.get(r);
    if (f === undefined) faceOfPiece.set(r, (f = faces.push({ loops: [], area: 0, vertices: 0 }) - 1));
    faceIdx[i] = f;
    faces[f]!.loops.push(c.hs.map((h): Pt => [vx[from(h)]! * g, vy[from(h)]! * g]));
    faces[f]!.area += c.area * g * g;
  });

  // Vertex count: corners of the lines on the torus (meeting points, or turns), not tile-edge cuts.
  const tkey = (x: number, y: number) => `${x % N},${y % N}`;
  const dirs = new Map<string, [number, number][]>();
  for (const s of real) {
    for (const [x, y, dx, dy] of [
      [s[0], s[1], s[2] - s[0], s[3] - s[1]],
      [s[2], s[3], s[0] - s[2], s[1] - s[3]],
    ] as const) {
      const k = tkey(x, y);
      if (!dirs.has(k)) dirs.set(k, []);
      dirs.get(k)!.push([dx, dy]);
    }
  }
  const corner = (k: string) => {
    const d = dirs.get(k);
    if (!d || d.length < 2) return false;
    if (d.length > 2) return true;
    const [[ax, ay], [bx, by]] = d as [[number, number], [number, number]];
    return Math.abs(ax * by - ay * bx) > 1e-3 * Math.hypot(ax, ay) * Math.hypot(bx, by) || ax * bx + ay * by > 0;
  };
  const seen = faces.map(() => new Set<string>());
  cycles.forEach((c, i) => {
    const f = faceIdx[i]!;
    if (f < 0) return;
    for (const h of c.hs) {
      const k = tkey(vx[from(h)]!, vy[from(h)]!);
      if (corner(k)) seen[f]!.add(k);
    }
  });
  seen.forEach((s, f) => (faces[f]!.vertices = s.size));

  // Adjacency across real edges (a perimeter edge's two sides are its inside and its twin's inside).
  const adj = faces.map(() => new Set<number>());
  const link = (a: number, b: number) => {
    if (a < 0 || b < 0 || a === b) return;
    adj[a]!.add(b);
    adj[b]!.add(a);
  };
  const faceAt = (h: number) => faceIdx[cycleOf[h]!]!;
  edges.forEach((e, i) => {
    if (!e.real) return;
    if (e.twin < 0) link(faceAt(2 * i), faceAt(2 * i + 1));
    else if (e.twin > i) {
      const a = faceAt(2 * i) >= 0 ? faceAt(2 * i) : faceAt(2 * i + 1);
      const b = faceAt(2 * e.twin) >= 0 ? faceAt(2 * e.twin) : faceAt(2 * e.twin + 1);
      link(a, b);
    }
  });
  return { faces, adjacency: adj.map((s) => [...s].sort((a, b) => a - b)) };
}

function inside(x: number, y: number, hs: number[], from: (h: number) => number, vx: number[], vy: number[]): boolean {
  let c = false;
  for (let i = 0, n = hs.length; i < n; i++) {
    const a = from(hs[i]!);
    const b = from(hs[(i + 1) % n]!);
    if (vy[a]! > y !== vy[b]! > y && x < ((vx[b]! - vx[a]!) * (y - vy[a]!)) / (vy[b]! - vy[a]!) + vx[a]!) c = !c;
  }
  return c;
}

class UnionFind {
  p: Int32Array;
  constructor(n: number) {
    this.p = Int32Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.p[i] !== i) i = this.p[i] = this.p[this.p[i]!]!;
    return i;
  }
  union(a: number, b: number): void {
    if (a >= 0 && b >= 0) this.p[this.find(a)] = this.find(b);
  }
}

function dedupe(segs: Seg[]): Seg[] {
  const m = new Map<string, Seg>();
  for (const s of segs) {
    if (s[0] === s[2] && s[1] === s[3]) continue;
    const t: Seg = s[0] < s[2] || (s[0] === s[2] && s[1] < s[3]) ? s : [s[2], s[3], s[0], s[1]];
    m.set(t.join(), t);
  }
  return [...m.values()];
}

// Cuts every segment at crossings and at points where another segment ends on it.
// ponytail: uniform grid buckets; enough for app tiles of a few thousand segments.
function split(segs: Seg[], N: number): Seg[] {
  const cuts: [number, number][][] = segs.map(() => []);
  const cell = Math.max(1, N / 32);
  const buckets = new Map<number, number[]>();
  segs.forEach((s, i) => {
    for (let cx = Math.floor(Math.min(s[0], s[2]) / cell); cx <= Math.floor(Math.max(s[0], s[2]) / cell); cx++) {
      for (let cy = Math.floor(Math.min(s[1], s[3]) / cell); cy <= Math.floor(Math.max(s[1], s[3]) / cell); cy++) {
        const k = cx * 4096 + cy;
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k)!.push(i);
      }
    }
  });
  const done = new Set<number>();
  for (const list of buckets.values()) {
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const i = list[a]!;
        const j = list[b]!;
        const key = i * segs.length + j;
        if (done.has(key)) continue;
        done.add(key);
        meet(segs[i]!, segs[j]!, cuts[i]!, cuts[j]!);
      }
    }
  }
  const out: Seg[] = [];
  segs.forEach((s, i) => {
    const [ax, ay, bx, by] = s;
    const dx = bx - ax;
    const dy = by - ay;
    const pts = [[ax, ay] as [number, number], ...cuts[i]!, [bx, by] as [number, number]];
    pts.sort((p, r) => (p[0] - ax) * dx + (p[1] - ay) * dy - ((r[0] - ax) * dx + (r[1] - ay) * dy));
    for (let k = 1; k < pts.length; k++) out.push([pts[k - 1]![0], pts[k - 1]![1], pts[k]![0], pts[k]![1]]);
  });
  return out;
}

function meet(s: Seg, t: Seg, cs: [number, number][], ct: [number, number][]): void {
  if (Math.max(s[0], s[2]) < Math.min(t[0], t[2]) - 1 || Math.max(t[0], t[2]) < Math.min(s[0], s[2]) - 1) return;
  if (Math.max(s[1], s[3]) < Math.min(t[1], t[3]) - 1 || Math.max(t[1], t[3]) < Math.min(s[1], s[3]) - 1) return;
  // Endpoints of one lying on the other (touches and collinear overlaps).
  onSeg(t[0], t[1], s, cs);
  onSeg(t[2], t[3], s, cs);
  onSeg(s[0], s[1], t, ct);
  onSeg(s[2], s[3], t, ct);
  const rx = s[2] - s[0];
  const ry = s[3] - s[1];
  const ux = t[2] - t[0];
  const uy = t[3] - t[1];
  const d = rx * uy - ry * ux;
  if (d === 0) return;
  const a = ((t[0] - s[0]) * uy - (t[1] - s[1]) * ux) / d;
  const b = ((t[0] - s[0]) * ry - (t[1] - s[1]) * rx) / d;
  if (a <= 0 || a >= 1 || b <= 0 || b >= 1) return;
  const p: [number, number] = [Math.round(s[0] + a * rx), Math.round(s[1] + a * ry)];
  cs.push(p);
  ct.push(p);
}

function onSeg(x: number, y: number, s: Seg, cs: [number, number][]): void {
  const dx = s[2] - s[0];
  const dy = s[3] - s[1];
  const l2 = dx * dx + dy * dy;
  const t = ((x - s[0]) * dx + (y - s[1]) * dy) / l2;
  if (t <= 0 || t >= 1) return;
  const ex = s[0] + t * dx - x;
  const ey = s[1] + t * dy - y;
  if (ex * ex + ey * ey <= 0.5) cs.push([x, y]);
}

// Drops dangling chains: segments with an end of degree 1 on the torus.
function prune(segs: Seg[], N: number): Seg[] {
  const key = (x: number, y: number) => (x % N) * (N + 1) + (y % N);
  const deg = new Map<number, number>();
  const ends = segs.map((s) => [key(s[0], s[1]), key(s[2], s[3])] as const);
  for (const e of ends.flat()) deg.set(e, (deg.get(e) ?? 0) + 1);
  const alive = segs.map(() => true);
  const at = new Map<number, number[]>();
  ends.forEach(([a, b], i) => {
    for (const k of [a, b]) {
      if (!at.has(k)) at.set(k, []);
      at.get(k)!.push(i);
    }
  });
  const stack = [...deg].filter(([, d]) => d === 1).map(([k]) => k);
  while (stack.length) {
    const k = stack.pop()!;
    if (deg.get(k) !== 1) continue;
    const i = at.get(k)!.find((j) => alive[j]);
    if (i === undefined) continue;
    alive[i] = false;
    for (const e of ends[i]!) {
      deg.set(e, deg.get(e)! - 1);
      if (deg.get(e) === 1) stack.push(e);
    }
  }
  return segs.filter((_, i) => alive[i]);
}

export function colourFaces(
  faces: Face[],
  adjacency: number[][],
  mode: 'shape' | 'neighbours',
  k: number,
): { colour: number[]; ok: boolean } {
  const n = faces.length;
  if (mode === 'shape') {
    const total = faces.reduce((s, f) => s + f.area, 0);
    const groups = new Map<string, { area: number; members: number[] }>();
    faces.forEach((f, i) => {
      const sig = `${Math.round((100 * f.area) / total)}:${f.vertices}`;
      if (!groups.has(sig)) groups.set(sig, { area: 0, members: [] });
      const gr = groups.get(sig)!;
      gr.area += f.area;
      gr.members.push(i);
    });
    const colour = Array<number>(n).fill(0);
    [...groups.values()].sort((a, b) => b.area - a.area).forEach((gr, c) => gr.members.forEach((i) => (colour[i] = c % k)));
    return { colour, ok: true };
  }
  // DSatur; when no free colour is left, take the one with the fewest clashing neighbours.
  const colour = Array<number>(n).fill(-1);
  for (let step = 0; step < n; step++) {
    let best = -1;
    let bestSat = -1;
    for (let i = 0; i < n; i++) {
      if (colour[i] !== -1) continue;
      const sat = new Set(adjacency[i]!.map((j) => colour[j]!).filter((c) => c >= 0)).size;
      if (sat > bestSat || (sat === bestSat && adjacency[i]!.length > adjacency[best]!.length)) [best, bestSat] = [i, sat];
    }
    const count = Array<number>(k).fill(0);
    for (const j of adjacency[best]!) if (colour[j]! >= 0) count[colour[j]!]!++;
    colour[best] = count.indexOf(Math.min(...count));
  }
  const ok = adjacency.every((ns, i) => ns.every((j) => colour[j] !== colour[i]));
  return { colour, ok };
}

// One <path> per colour, each face's loops as subpaths; drawn under the lines.
export function regionsSvg(faces: Face[], colour: number[], colours: readonly string[], _size: number): string {
  return colours
    .map((fill, c) => {
      const d = faces
        .filter((_, i) => colour[i] === c)
        .flatMap((f) => f.loops)
        .map((l) => `M${l.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L')}Z`)
        .join('');
      return d ? `<path fill="${fill}" fill-rule="nonzero" d="${d}"/>` : '';
    })
    .join('');
}
