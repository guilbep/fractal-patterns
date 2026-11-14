// Interlace: join wrapped pieces into strands on the torus, find crossings,
// alternate over/under along each strand, draw ribbons with gaps at under-passages.
import { TAU, type Poly, type Pt } from './util.ts';

// pieces: consecutive polylines of the strand; a jump between pieces is a tile-edge crossing.
// joins: where the strand goes straight through a vertex shared with other lines.
export interface Strand {
  pieces: Poly[];
  closed: boolean;
  joins?: Join[];
}
export interface Join {
  at: string; // vertex key, the same for every passage through that vertex
  p: Pt;
  s: number;
  din: Pt; // direction in
  dout: Pt; // direction out
}
export interface Passage {
  strand: number;
  s: number; // arc length along the strand
}
export interface Crossing {
  id: number;
  p: Pt;
  a: Passage;
  b: Passage;
}
export type OverUnder = Map<number, 'a' | 'b'>;

// Points are matched modulo the tile (x = size is x = 0) on a grid of 1e-6 * size.
// ponytail: grid snap, two points within eps can still round apart; cluster if that ever shows.
function vertexKey([x, y]: Pt, size: number): string {
  const eps = 1e-6 * size;
  const S = Math.round(size / eps);
  const q = (v: number) => ((Math.round(v / eps) % S) + S) % S;
  return `${q(x)},${q(y)}`;
}

// Graph of all segments; at each vertex the ends are paired as straightest continuations,
// so strands go straight through crossings that sit on shared vertices (Hankin stars).
export function strands(polys: Poly[], size: number): Strand[] {
  // Edge e has ends 2e (at a) and 2e + 1 (at b).
  const ea: Pt[] = [];
  const eb: Pt[] = [];
  const keyOf: string[] = [];
  const byKey = new Map<string, number[]>();
  for (const p of polys)
    for (let i = 1; i < p.length; i++) {
      const ka = vertexKey(p[i - 1]!, size);
      const kb = vertexKey(p[i]!, size);
      // A segment across the whole tile has both ends on one vertex: drop only true zero lengths.
      if (Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]) < 1e-6 * size) continue;
      const e = ea.length;
      ea.push(p[i - 1]!);
      eb.push(p[i]!);
      keyOf.push(ka, kb);
      byKey.set(ka, [...(byKey.get(ka) ?? []), 2 * e]);
      byKey.set(kb, [...(byKey.get(kb) ?? []), 2 * e + 1]);
    }
  const pt = (x: number) => (x & 1 ? eb : ea)[x >> 1]!;
  // Unit direction leaving the vertex along end x's edge.
  const dir = (x: number): Pt => {
    const [ax, ay] = pt(x);
    const [bx, by] = pt(x ^ 1);
    const l = Math.hypot(bx - ax, by - ay);
    return [(bx - ax) / l, (by - ay) / l];
  };
  const partner = new Map<number, number>();
  const crossing = new Set<string>(); // vertices of degree 4+
  for (const [k, ends] of byKey) {
    // Degree 3 or odd: the ends stay open.
    if (ends.length % 2) continue;
    if (ends.length > 2) crossing.add(k);
    const left = [...ends];
    const ds = new Map(left.map((x) => [x, dir(x)]));
    while (left.length) {
      // Greedy: the pair closest to opposite directions.
      let bi = 0;
      let bj = 1;
      let best = Infinity;
      for (let i = 0; i < left.length; i++)
        for (let j = i + 1; j < left.length; j++) {
          const [ux, uy] = ds.get(left[i]!)!;
          const [vx, vy] = ds.get(left[j]!)!;
          const d = ux * vx + uy * vy;
          if (d < best) [best, bi, bj] = [d, i, j];
        }
      const x = left[bi]!;
      const y = left[bj]!;
      partner.set(x, y);
      partner.set(y, x);
      left.splice(bj, 1);
      left.splice(bi, 1);
    }
  }
  const seen = new Uint8Array(ea.length);
  const out: Strand[] = [];
  const eps = 1e-6 * size;
  // Walk entering edges at end x; a new piece starts wherever the coordinates jump (tile edge).
  const walk = (start: number): Strand => {
    const pieces: Poly[] = [];
    const joins: Join[] = [];
    let piece: Poly | null = null;
    let s = 0;
    let x = start;
    let closed = false;
    for (;;) {
      seen[x >> 1] = 1;
      const a = pt(x);
      const b = pt(x ^ 1);
      const last = piece?.[piece.length - 1];
      if (!piece || !last || Math.hypot(last[0] - a[0], last[1] - a[1]) > eps) {
        piece = [a];
        pieces.push(piece);
      }
      piece.push(b);
      s += Math.hypot(b[0] - a[0], b[1] - a[1]);
      const y = partner.get(x ^ 1);
      if (y === undefined) break;
      const k = keyOf[x ^ 1]!;
      if (crossing.has(k)) {
        const [ix, iy] = dir(x ^ 1);
        joins.push({ at: k, p: b, s, din: [-ix, -iy], dout: dir(y) });
      }
      if (y === start) {
        closed = true;
        break;
      }
      if (seen[y >> 1]) break;
      x = y;
    }
    return joins.length ? { pieces, closed, joins } : { pieces, closed };
  };
  // Open chains first (from a free end), then the remaining closed loops.
  for (let e = 0; e < ea.length; e++) {
    if (seen[e]) continue;
    if (!partner.has(2 * e)) out.push(walk(2 * e));
    else if (!partner.has(2 * e + 1)) out.push(walk(2 * e + 1));
  }
  for (let e = 0; e < ea.length; e++) if (!seen[e]) out.push(walk(2 * e));
  return out;
}

interface Seg {
  strand: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  s: number; // arc length at a
}

function segments(list: Strand[]): Seg[] {
  const segs: Seg[] = [];
  list.forEach((st, strand) => {
    let s = 0;
    for (const p of st.pieces)
      for (let i = 1; i < p.length; i++) {
        const [ax, ay] = p[i - 1]!;
        const [bx, by] = p[i]!;
        segs.push({ strand, ax, ay, bx, by, s });
        s += Math.hypot(bx - ax, by - ay);
      }
  });
  return segs;
}

// Proper crossings (both parameters strictly inside), plus the crossings strands() recorded on shared vertices.
export function crossings(list: Strand[]): Crossing[] {
  const segs = segments(list).sort((u, v) => Math.min(u.ax, u.bx) - Math.min(v.ax, v.bx));
  const out: Crossing[] = [];
  const eps = 1e-9;
  // Sweep on x: only pairs whose x ranges overlap are tested.
  for (let i = 0; i < segs.length; i++) {
    const u = segs[i]!;
    const uMax = Math.max(u.ax, u.bx);
    const ux = u.bx - u.ax;
    const uy = u.by - u.ay;
    for (let j = i + 1; j < segs.length; j++) {
      const v = segs[j]!;
      if (Math.min(v.ax, v.bx) > uMax) break;
      const vx = v.bx - v.ax;
      const vy = v.by - v.ay;
      const den = ux * vy - uy * vx;
      if (Math.abs(den) < 1e-12) continue;
      const wx = v.ax - u.ax;
      const wy = v.ay - u.ay;
      const t = (wx * vy - wy * vx) / den;
      const w = (wx * uy - wy * ux) / den;
      if (t <= eps || t >= 1 - eps || w <= eps || w >= 1 - eps) continue;
      out.push({
        id: out.length,
        p: [u.ax + t * ux, u.ay + t * uy],
        a: { strand: u.strand, s: u.s + t * Math.hypot(ux, uy) },
        b: { strand: v.strand, s: v.s + w * Math.hypot(vx, vy) },
      });
    }
  }
  // Crossings on shared vertices: two passages through one vertex cross when their directions interleave.
  const at = new Map<string, [number, Join][]>();
  list.forEach((st, i) => {
    for (const j of st.joins ?? []) at.set(j.at, [...(at.get(j.at) ?? []), [i, j]]);
  });
  const ang = ([x, y]: Pt, from: number) => (((Math.atan2(y, x) - from) % TAU) + TAU) % TAU;
  for (const list of at.values())
    for (let i = 0; i < list.length; i++)
      for (let k = i + 1; k < list.length; k++) {
        const [sa, ja] = list[i]!;
        const [sb, jb] = list[k]!;
        // Angles from ja's way back, counter-clockwise: jb's two directions must sit on either side of ja's way out.
        const back = Math.atan2(-ja.din[1], -ja.din[0]);
        const o = ang(ja.dout, back);
        if (ang([-jb.din[0], -jb.din[1]], back) < o === ang(jb.dout, back) < o) continue;
        out.push({ id: out.length, p: ja.p, a: { strand: sa, s: ja.s }, b: { strand: sb, s: jb.s } });
      }
  return out;
}

// Passages along each strand, in arc-length order: node = 2 * crossing + (0 a | 1 b).
function passagesByStrand(n: number, cs: Crossing[]): number[][] {
  const by: number[][] = Array.from({ length: n }, () => []);
  for (const c of cs) {
    by[c.a.strand]!.push(2 * c.id);
    by[c.b.strand]!.push(2 * c.id + 1);
  }
  const sOf = (node: number) => (node & 1 ? cs[node >> 1]!.b.s : cs[node >> 1]!.a.s);
  for (const l of by) l.sort((x, y) => sOf(x) - sOf(y));
  return by;
}

// 2-colouring (1 = over) of passages: a crossing's two passages differ, consecutive passages on a strand differ.
export function interlace(list: Strand[], cs: Crossing[]): { overUnder: OverUnder; odd: number[] } {
  const by = passagesByStrand(list.length, cs);
  const odd = new Set<number>();
  // A closed strand with an odd number of passages cannot alternate: skip alternation on it.
  by.forEach((l, i) => {
    if (list[i]!.closed && l.length % 2 === 1) odd.add(i);
  });
  const adj: [number, number][][] = Array.from({ length: 2 * cs.length }, () => []); // [node, strand | -1]
  for (let i = 0; i < cs.length; i++) {
    adj[2 * i]!.push([2 * i + 1, -1]);
    adj[2 * i + 1]!.push([2 * i, -1]);
  }
  by.forEach((l, st) => {
    if (odd.has(st)) return;
    const m = list[st]!.closed && l.length > 2 ? l.length : l.length - 1;
    for (let k = 0; k < m; k++) {
      const x = l[k]!;
      const y = l[(k + 1) % l.length]!;
      adj[x]!.push([y, st]);
      adj[y]!.push([x, st]);
    }
  });
  const colour = new Int8Array(2 * cs.length).fill(-1);
  for (let start = 0; start < colour.length; start++) {
    if (colour[start] !== -1) continue;
    colour[start] = 1;
    const queue = [start];
    while (queue.length) {
      const x = queue.pop()!;
      for (const [y, st] of adj[x]!) {
        if (colour[y] === -1) {
          colour[y] = 1 - colour[x]!;
          queue.push(y);
        } else if (colour[y] === colour[x] && st >= 0) odd.add(st);
      }
    }
  }
  const overUnder: OverUnder = new Map();
  for (const c of cs) overUnder.set(c.id, colour[2 * c.id] === 1 ? 'a' : 'b');
  return { overUnder, odd: [...odd].sort((x, y) => x - y) };
}

const r1 = (v: number) => String(Math.round(v * 10) / 10);

// Path data of a strand with the arc-length intervals in `cuts` removed; each piece starts a subpath.
function strandPath(st: Strand, rawCuts: [number, number][]): string {
  const out: string[] = [];
  let total = 0;
  for (const p of st.pieces) for (let i = 1; i < p.length; i++) total += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
  // A gap that runs past the start of a closed strand continues at its end, and back.
  const cuts = st.closed
    ? rawCuts.flatMap(([a, b]): [number, number][] => [
        [a, b],
        [a - total, b - total],
        [a + total, b + total],
      ])
    : rawCuts;
  const inCut = (s: number) => cuts.some(([a, b]) => s > a && s < b);
  // Arc-length breakpoints where the pen goes up or down.
  const marks = cuts.flat();
  let s = 0;
  for (const p of st.pieces) {
    let pen = false;
    const at = (x: number, y: number) => {
      out.push(`${pen ? 'L' : 'M'}${r1(x)} ${r1(y)}`);
      pen = true;
    };
    if (!inCut(s)) at(p[0]![0], p[0]![1]);
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1]!;
      const [bx, by] = p[i]!;
      const len = Math.hypot(bx - ax, by - ay);
      const inside = marks.filter((m) => m > s && m < s + len).sort((x, y) => x - y);
      for (const m of inside) {
        const t = (m - s) / len;
        const x = ax + t * (bx - ax);
        const y = ay + t * (by - ay);
        if (inCut(m + 1e-9)) {
          if (pen) at(x, y);
          pen = false;
        } else if (!pen) at(x, y);
      }
      s += len;
      if (!inCut(s - 1e-9) && pen) at(bx, by);
    }
  }
  return out.join('');
}

export interface RibbonStyle {
  width: number;
  gap: number;
  size: number;
  fill: string;
  stroke: string;
}

// Two strokes per strand: outline (wide) then fill (narrow). 3x3 copies via <use> make the edges seamless.
export function ribbonsSvg(list: Strand[], cs: Crossing[], overUnder: OverUnder, o: RibbonStyle): string {
  const cuts: [number, number][][] = list.map(() => []);
  for (const c of cs) {
    const under = overUnder.get(c.id) === 'a' ? c.b : c.a;
    cuts[under.strand]!.push([under.s - o.gap, under.s + o.gap]);
  }
  const inner = Math.max(0, o.width - 2 * Math.max(1, o.width / 6));
  const body = list
    .map((st, i) => {
      const d = strandPath(st, cuts[i]!);
      if (!d) return '';
      return `<path d="${d}" stroke="${o.stroke}" stroke-width="${r1(o.width)}"/><path d="${d}" stroke="${o.fill}" stroke-width="${r1(inner)}"/>`;
    })
    .join('');
  const uses: string[] = [];
  for (const dx of [-o.size, 0, o.size])
    for (const dy of [-o.size, 0, o.size]) if (dx || dy) uses.push(`<use href="#il" transform="translate(${dx} ${dy})"/>`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.size} ${o.size}">` +
    `<g id="il" fill="none" stroke-linecap="butt" stroke-linejoin="round">${body}</g>${uses.join('')}</svg>`
  );
}
